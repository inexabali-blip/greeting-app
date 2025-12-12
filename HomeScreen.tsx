import React, { useEffect, useState } from 'react';
import { getFullHistory, deletePerson, saveCard } from '../services/storageService';
import { SavedGreeting, Holiday, GreetingCard, Gender, Relationship } from '../types';
import { generateGreetingText, generateGreetingImage } from '../services/geminiService';
import { Calendar, Trash2, ChevronRight, Share2, Download, RotateCw, Loader2, Sparkles, CheckCircle2, Circle } from 'lucide-react';

// --- HELPER LOGIC FOR EVENTS ---

interface PersonEvent {
  person: SavedGreeting;
  holiday: Holiday;
  daysLeft: number;
  date: Date;
  isToday: boolean;
}

interface FixedHolidayConfig {
  type: Holiday;
  month: number;
  day: number;
  gender?: Gender | null;
  relationship?: Relationship;
}

const FIXED_HOLIDAYS: FixedHolidayConfig[] = [
  { type: Holiday.NEW_YEAR, month: 0, day: 1, gender: null }, // Jan 1
  { type: Holiday.MENS_DAY, month: 1, day: 23, gender: Gender.MALE }, // Feb 23
  { type: Holiday.VALENTINES_DAY, month: 1, day: 14, relationship: Relationship.PARTNER }, // Feb 14
  { type: Holiday.WOMENS_DAY, month: 2, day: 8, gender: Gender.FEMALE }, // Mar 8
];

const getNextEventForPerson = (person: SavedGreeting): PersonEvent => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();

  let closestEvent: PersonEvent | null = null;
  let minDiff = Infinity;

  // 1. Check Birthday - ONLY if birthDate is present
  if (person.birthDate) {
    const birth = new Date(person.birthDate);
    if (!isNaN(birth.getTime())) {
        let nextBday = new Date(currentYear, birth.getMonth(), birth.getDate());
        if (nextBday < today) nextBday.setFullYear(currentYear + 1);
        
        const diffTime = nextBday.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < minDiff) {
          minDiff = diffDays;
          closestEvent = {
            person,
            holiday: Holiday.BIRTHDAY,
            daysLeft: diffDays,
            date: nextBday,
            isToday: diffDays === 0
          };
        }
    }
  }

  // 2. Check Fixed Holidays
  FIXED_HOLIDAYS.forEach(h => {
    // Filter by Gender
    if (h.gender && person.gender !== h.gender) return;

    // Filter by Relationship
    if (h.relationship && person.relationship !== h.relationship) return;

    let nextDate = new Date(currentYear, h.month, h.day);
    if (nextDate < today) nextDate.setFullYear(currentYear + 1);

    const diffTime = nextDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < minDiff) {
      minDiff = diffDays;
      closestEvent = {
        person,
        holiday: h.type,
        daysLeft: diffDays,
        date: nextDate,
        isToday: diffDays === 0
      };
    }
  });

  // Fallback if no birthday and no specific holidays matched (rare) -> Next New Year
  if (!closestEvent) {
     let nextNY = new Date(currentYear + 1, 0, 1);
     const diffDays = Math.ceil((nextNY.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
     closestEvent = {
         person,
         holiday: Holiday.NEW_YEAR,
         daysLeft: diffDays,
         date: nextNY,
         isToday: diffDays === 0
     };
  }

  return closestEvent;
};

export const HomeScreen: React.FC = () => {
  const [people, setPeople] = useState<SavedGreeting[]>([]);
  const [events, setEvents] = useState<PersonEvent[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<SavedGreeting | null>(null);

  // Detail View State
  const [currentText, setCurrentText] = useState('');
  const [currentImage, setCurrentImage] = useState('');
  const [currentHoliday, setCurrentHoliday] = useState<Holiday>(Holiday.BIRTHDAY);
  const [isRegeneratingText, setIsRegeneratingText] = useState(false);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);

  // Batch Mode State
  const [batchMode, setBatchMode] = useState(false);
  const [selectedForBatch, setSelectedForBatch] = useState<string[]>([]);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedPerson && selectedPerson.latestCard) {
      setCurrentText(selectedPerson.latestCard.generatedText);
      setCurrentImage(selectedPerson.latestCard.generatedImageUrl);
      
      // Determine context based on calculated event
      const evt = getNextEventForPerson(selectedPerson);
      if (evt.isToday) {
        setCurrentHoliday(evt.holiday);
      } else {
        setCurrentHoliday(selectedPerson.latestCard.holiday || Holiday.BIRTHDAY);
      }
    }
  }, [selectedPerson]);

  const loadData = () => {
    const rawPeople = getFullHistory();
    setPeople(rawPeople);
    
    // Calculate events and sort
    const calculatedEvents = rawPeople.map(p => getNextEventForPerson(p));
    // Sort: Today's events first, then closest dates
    calculatedEvents.sort((a, b) => a.daysLeft - b.daysLeft);
    setEvents(calculatedEvents);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Удалить этого человека и историю поздравлений?')) {
      deletePerson(id);
      loadData();
      if (selectedPerson?.id === id) {
        setSelectedPerson(null);
      }
    }
  };

  // Helper to compress image
  const compressImage = async (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const maxDim = 800;
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > maxDim) { height *= maxDim / width; width = maxDim; }
            } else {
                if (height > maxDim) { width *= maxDim / height; height = maxDim; }
            }
            canvas.width = width;
            canvas.height = height;
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            } else { resolve(base64Str); }
        };
        img.onerror = () => resolve(base64Str);
    });
  };

  const updateCardInStorage = async (newText: string, newImage: string) => {
      if (!selectedPerson) return;
      
      let storedImage = newImage;
      if (newImage && newImage.startsWith('data:')) {
          storedImage = await compressImage(newImage);
      }

      const updatedCard: GreetingCard = {
          id: selectedPerson.latestCard?.id || Date.now().toString(), // fallback ID
          personId: selectedPerson.id,
          generatedText: newText,
          generatedImageUrl: storedImage,
          holiday: currentHoliday,
          createdAt: Date.now()
      };
      
      saveCard(updatedCard);
      loadData();
  };

  const handleRegenerateText = async () => {
      if (!selectedPerson) return;
      setIsRegeneratingText(true);
      try {
          const text = await generateGreetingText({
              name: selectedPerson.name,
              age: selectedPerson.age,
              gender: selectedPerson.gender,
              relationship: selectedPerson.relationship,
              holiday: currentHoliday
          });
          setCurrentText(text);
          await updateCardInStorage(text, currentImage);
      } catch (e) {
          console.error(e);
          alert("Ошибка генерации текста");
      } finally {
          setIsRegeneratingText(false);
      }
  };

  const handleRegenerateImage = async () => {
      if (!selectedPerson) return;
      setIsRegeneratingImage(true);
      try {
          const img = await generateGreetingImage({
              name: selectedPerson.name,
              age: selectedPerson.age,
              gender: selectedPerson.gender,
              relationship: selectedPerson.relationship,
              holiday: currentHoliday
          });
          setCurrentImage(img);
          await updateCardInStorage(currentText, img);
      } catch (e) {
          console.error(e);
          alert("Ошибка генерации изображения");
      } finally {
          setIsRegeneratingImage(false);
      }
  };

  // --- BATCH GENERATION LOGIC ---
  const handleBatchToggle = (personId: string) => {
    if (selectedForBatch.includes(personId)) {
        setSelectedForBatch(prev => prev.filter(id => id !== personId));
    } else {
        setSelectedForBatch(prev => [...prev, personId]);
    }
  };

  const handleBatchGenerate = async () => {
      if (selectedForBatch.length === 0) return;
      
      setIsBatchGenerating(true);
      setBatchProgress({ current: 0, total: selectedForBatch.length });

      for (let i = 0; i < selectedForBatch.length; i++) {
          const personId = selectedForBatch[i];
          const personEvent = events.find(e => e.person.id === personId);
          
          if (personEvent) {
              setBatchProgress({ current: i + 1, total: selectedForBatch.length });
              
              try {
                // 1. Generate Content
                const requestData = {
                    name: personEvent.person.name,
                    age: personEvent.person.age,
                    gender: personEvent.person.gender,
                    relationship: personEvent.person.relationship,
                    holiday: personEvent.holiday
                };

                const [text, image] = await Promise.all([
                    generateGreetingText(requestData),
                    generateGreetingImage(requestData)
                ]);

                // 2. Save
                let storedImage = image;
                if (image && image.startsWith('data:')) {
                    storedImage = await compressImage(image);
                }

                const newCard: GreetingCard = {
                    id: Date.now() + '_' + i,
                    personId: personEvent.person.id,
                    generatedText: text,
                    generatedImageUrl: storedImage,
                    holiday: personEvent.holiday,
                    createdAt: Date.now()
                };
                
                saveCard(newCard);
                
              } catch (e) {
                  console.error(`Failed batch generation for ${personEvent.person.name}`, e);
                  // Continue to next person even if one fails
              }
          }
      }
      
      setIsBatchGenerating(false);
      setBatchMode(false);
      setSelectedForBatch([]);
      loadData(); // Refresh list to show new cards
      alert("Готово! Все поздравления созданы. Теперь вы можете отправить их.");
  };

  // --- COMPOSITING (Shared) ---
  const createCompositeImage = async (imageUrl: string, text: string): Promise<File | null> => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imageUrl;
        img.onload = () => {
            const width = 1080;
            const height = 1920;
            canvas.width = width;
            canvas.height = height;
            if (!ctx) { resolve(null); return; }
            
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, width);

            const textStartY = width + 50;
            const textHeight = height - width;
            
            ctx.fillStyle = '#1f2937';
            ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            
            const maxWidth = width - 120;
            const lineHeight = 70;
            const words = text.split(' ');
            let line = '';
            const lines = [];

            for(let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxWidth && n > 0) {
                    lines.push(line);
                    line = words[n] + ' ';
                } else { line = testLine; }
            }
            lines.push(line);

            const totalTextHeight = lines.length * lineHeight;
            let y = textStartY + (textHeight - totalTextHeight) / 2 - 40;
            if (y < textStartY) y = textStartY + 20;

            for (let i = 0; i < lines.length; i++) {
                ctx.fillText(lines[i], width / 2, y + (i * lineHeight));
            }

            canvas.toBlob((blob) => {
                if (blob) resolve(new File([blob], `card_${Date.now()}.png`, { type: 'image/png' }));
                else resolve(null);
            }, 'image/png');
        };
        img.onerror = () => resolve(null);
    });
  };

  const handleShareComposite = async () => {
    try {
        const file = await createCompositeImage(currentImage, currentText);
        if (!file) { alert("Ошибка создания открытки."); return; }
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file] });
        } else {
             alert("Ваше устройство не поддерживает отправку файлов.");
             handleDownloadComposite();
        }
    } catch (e) { console.error("Share failed", e); }
  };

  const handleDownloadComposite = async () => {
      const file = await createCompositeImage(currentImage, currentText);
      if (file) {
          const url = URL.createObjectURL(file);
          const link = document.createElement('a');
          link.href = url;
          link.download = `greeting_card_${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      }
  };

  // --- WIDGETS ---
  const EventsWidget = () => {
    // Filter events happening TODAY or TOMORROW
    const urgentEvents = events.filter(e => e.daysLeft <= 1);

    if (urgentEvents.length === 0) return null;

    if (isBatchGenerating) {
        return (
            <div className="bg-white border border-purple-200 rounded-2xl p-6 text-center shadow-lg mb-6">
                <Loader2 className="animate-spin text-purple-600 w-10 h-10 mx-auto mb-4" />
                <h3 className="font-bold text-gray-800 text-lg">Создаем поздравления...</h3>
                <p className="text-gray-500 mt-2">Обработано {batchProgress.current} из {batchProgress.total}</p>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4">
                    <div className="bg-purple-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}></div>
                </div>
            </div>
        )
    }

    return (
      <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-2xl p-5 text-white shadow-xl mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
            <Sparkles size={100} />
        </div>
        
        <div className="relative z-10">
            <h3 className="font-bold text-lg mb-1">🎉 События сегодня!</h3>
            <p className="text-purple-100 text-sm mb-4">Нужно поздравить {urgentEvents.length} человек(а)</p>
            
            {!batchMode ? (
                <button 
                    onClick={() => {
                        setBatchMode(true);
                        // Auto-select everyone who has an event today
                        setSelectedForBatch(urgentEvents.map(e => e.person.id));
                    }}
                    className="bg-white text-purple-700 px-4 py-2 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-transform w-full"
                >
                    Поздравить всех
                </button>
            ) : (
                <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Выбрано: {selectedForBatch.length}</span>
                        <button onClick={() => setBatchMode(false)} className="text-xs text-purple-200">Отмена</button>
                    </div>
                    <button 
                        onClick={handleBatchGenerate}
                        className="bg-white text-purple-700 px-4 py-2 rounded-lg font-bold text-sm shadow-md w-full"
                    >
                        Сгенерировать ({selectedForBatch.length})
                    </button>
                </div>
            )}
        </div>
      </div>
    );
  };

  // --- RENDER DETAIL VIEW ---
  if (selectedPerson) {
    return (
      <div className="px-4 py-6 pb-24 animate-in slide-in-from-right duration-300 bg-gray-50 min-h-screen">
         {/* HEADER */}
         <div className="flex justify-between items-center mb-4 sticky top-0 bg-gray-50/90 backdrop-blur-md z-20 py-2">
            <button 
              onClick={() => setSelectedPerson(null)}
              className="text-purple-600 font-medium flex items-center bg-white border border-purple-100 px-3 py-1.5 rounded-xl shadow-sm"
            >
              ← Назад
            </button>
            <div className="flex items-center space-x-2">
                <div className="flex flex-col items-end mr-2">
                     <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Праздник</span>
                     <select 
                        value={currentHoliday}
                        onChange={(e) => setCurrentHoliday(e.target.value as Holiday)}
                        className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1 outline-none text-gray-700 font-medium shadow-sm"
                    >
                        {(Object.values(Holiday) as Holiday[]).map(h => (
                            <option key={h} value={h}>{h}</option>
                        ))}
                    </select>
                </div>
                <button 
                   onClick={(e) => handleDelete(e, selectedPerson.id)}
                   className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                >
                   <Trash2 size={20} />
                </button>
            </div>
         </div>
         
         {/* IMAGE EDITOR */}
         <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-purple-100 mb-4">
           <div className="relative aspect-square w-full bg-gray-100 flex items-center justify-center group">
             {isRegeneratingImage ? (
                 <div className="flex flex-col items-center">
                    <Loader2 className="animate-spin text-purple-600 mb-2" size={40} />
                    <span className="text-xs text-purple-400 font-medium">Рисуем...</span>
                 </div>
             ) : (
                 <img src={currentImage} alt="Card" className="w-full h-full object-cover" />
             )}
             
             {/* Overlay Controls */}
             <div className="absolute top-4 right-4 flex space-x-2">
                 <button 
                   onClick={handleRegenerateImage}
                   disabled={isRegeneratingImage}
                   className="bg-white/90 p-2.5 rounded-full shadow-sm text-gray-700 hover:text-purple-600 transition-colors backdrop-blur-sm active:scale-90 transform"
                 >
                   {isRegeneratingImage ? <Loader2 className="animate-spin" size={20}/> : <RotateCw size={20} />}
                 </button>
             </div>
           </div>
        </div>

        {/* TEXT EDITOR */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-purple-100 mb-6 relative">
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h3 className="text-xl font-bold text-gray-800">{selectedPerson.name}</h3>
                    {selectedPerson.birthDate ? (
                        <p className="text-xs text-gray-400">Дата рождения: {selectedPerson.birthDate.split('-').reverse().join('.')}</p>
                    ) : (
                        <p className="text-xs text-gray-400 italic">Дата рождения: Неизвестно</p>
                    )}
                </div>
                <button 
                   onClick={handleRegenerateText}
                   disabled={isRegeneratingText}
                   className="text-purple-600 text-xs font-bold flex items-center hover:bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-100 transition-colors uppercase tracking-wide"
                >
                   {isRegeneratingText ? <Loader2 className="animate-spin mr-1" size={12}/> : <RotateCw size={12} className="mr-1" />}
                   Переписать
                </button>
            </div>
            {isRegeneratingText ? (
                <div className="h-24 flex items-center justify-center">
                    <Loader2 className="text-purple-300 animate-spin" />
                </div>
            ) : (
                <textarea 
                    value={currentText}
                    onChange={(e) => setCurrentText(e.target.value)}
                    onBlur={() => updateCardInStorage(currentText, currentImage)}
                    className="w-full h-32 text-gray-600 text-base leading-relaxed outline-none resize-none bg-transparent placeholder-gray-300"
                    placeholder="Текст поздравления..."
                />
            )}
        </div>

        {/* ACTIONS */}
        <div className="flex flex-col space-y-3">
          <button 
              onClick={handleShareComposite}
              className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-purple-200 active:scale-95 transition-transform"
            >
              <Share2 size={20} />
              <span>Отправить поздравление</span>
          </button>
          
          <button 
              onClick={handleDownloadComposite}
              className="w-full flex items-center justify-center space-x-2 text-gray-500 py-3 rounded-xl font-medium hover:bg-gray-100 transition-colors"
          >
              <Download size={18} />
              <span>Скачать картинкой</span>
          </button>
        </div>
      </div>
    )
  }

  // --- RENDER LIST VIEW ---
  return (
    <div className="px-4 py-6 pb-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Календарь событий</h1>
        <div className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-md">
            {events.length} контактов
        </div>
      </div>

      <EventsWidget />

      {events.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Пока никого нет</p>
          <p className="text-gray-400 text-sm mt-1">Нажмите "+" внизу, чтобы добавить</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((evt) => {
            const isSelected = selectedForBatch.includes(evt.person.id);
            const isToday = evt.daysLeft === 0;

            return (
              <div 
                key={evt.person.id} 
                onClick={() => {
                    if (batchMode && isToday) {
                        handleBatchToggle(evt.person.id);
                    } else {
                        setSelectedPerson(evt.person);
                    }
                }}
                className={`
                    relative p-4 rounded-2xl shadow-sm border transition-all cursor-pointer group flex items-center justify-between
                    ${isToday ? 'bg-white border-purple-200 shadow-purple-100' : 'bg-white border-gray-100'}
                    ${batchMode && !isToday ? 'opacity-50 grayscale pointer-events-none' : ''}
                `}
              >
                <div className="flex items-center space-x-4">
                  {batchMode && isToday ? (
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                          {isSelected && <CheckCircle2 size={16} className="text-white" />}
                      </div>
                  ) : (
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${isToday ? 'bg-gradient-to-br from-yellow-300 to-orange-400 text-white shadow-md' : 'bg-gray-50 text-gray-400'}`}>
                        {evt.person.latestCard?.generatedImageUrl ? (
                            <img src={evt.person.latestCard.generatedImageUrl} className="w-full h-full object-cover rounded-full" />
                        ) : (
                            evt.person.name.charAt(0)
                        )}
                    </div>
                  )}
                  
                  <div>
                    <h3 className="font-bold text-gray-800 leading-tight">{evt.person.name}</h3>
                    <div className="flex items-center space-x-1.5 mt-1">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${isToday ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                            {evt.holiday}
                        </span>
                        <span className="text-xs text-gray-400">
                            {isToday ? 'Сегодня!' : `через ${evt.daysLeft} дн.`}
                        </span>
                    </div>
                  </div>
                </div>

                {!batchMode && (
                    <div className="text-gray-300 group-hover:text-purple-400">
                        <ChevronRight size={20} />
                    </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};