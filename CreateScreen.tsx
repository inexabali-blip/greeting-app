import React, { useState, useRef, useEffect } from 'react';
import { Gender, Relationship, PersonData, GreetingCard, Holiday } from '../types';
import { generateGreetingText, generateGreetingImage } from '../services/geminiService';
import { savePerson, saveCard } from '../services/storageService';
import { Loader2, Sparkles, Share2, Download, RotateCw, Pencil, Image as ImageIcon, Calendar, Baby } from 'lucide-react';

interface CreateScreenProps {
  onSuccess: () => void;
}

export const CreateScreen: React.FC<CreateScreenProps> = ({ onSuccess }) => {
  const [step, setStep] = useState<'form' | 'generating' | 'result'>('form');
  const [formData, setFormData] = useState({
    name: '',
    birthDate: '',
    gender: Gender.MALE,
    relationship: Relationship.FRIEND,
    holiday: Holiday.BIRTHDAY
  });
  
  // State specifically for Newborn gender
  const [childGender, setChildGender] = useState<Gender>(Gender.MALE);
  
  // Local state for the masked date input display (DD.MM.YYYY)
  const [dateInputValue, setDateInputValue] = useState('');

  const [generatedText, setGeneratedText] = useState('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');
  
  const [isRegeneratingText, setIsRegeneratingText] = useState(false);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  
  // Track current card ID to avoid duplicates during session
  const [currentCardId, setCurrentCardId] = useState<string>('');

  // Sync formData.birthDate (YYYY-MM-DD) to dateInputValue (DD.MM.YYYY) on mount or external update
  useEffect(() => {
      if (formData.birthDate && !dateInputValue) {
          const parts = formData.birthDate.split('-');
          if (parts.length === 3) {
              const [y, m, d] = parts;
              setDateInputValue(`${d}.${m}.${y}`);
          }
      }
  }, []);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // 1. Get only numbers
      let val = e.target.value.replace(/\D/g, '');
      
      // 2. Limit length (DDMMYYYY = 8 chars)
      if (val.length > 8) val = val.slice(0, 8);

      // 3. Format visual display with dots
      let formatted = val;
      if (val.length >= 2) {
          formatted = val.slice(0, 2) + '.' + val.slice(2);
      }
      if (val.length >= 4) {
          formatted = formatted.slice(0, 5) + '.' + formatted.slice(5);
      }
      
      setDateInputValue(formatted);

      // 4. Update actual formData only if full date is present
      if (val.length === 8) {
          const day = val.slice(0, 2);
          const month = val.slice(2, 4);
          const year = val.slice(4, 8);
          // Simple validation
          const numMonth = parseInt(month);
          const numDay = parseInt(day);
          
          if (numMonth > 0 && numMonth <= 12 && numDay > 0 && numDay <= 31) {
             setFormData(prev => ({ ...prev, birthDate: `${year}-${month}-${day}` }));
          }
      } else {
          // While typing, keep logical date empty to avoid invalid date calcs
          setFormData(prev => ({ ...prev, birthDate: '' }));
      }
  };

  const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 30; // Default adult age if date not provided for generic holidays
    const today = new Date();
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return 30;
    
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const getRequestData = () => {
     return {
        name: formData.name,
        age: calculateAge(formData.birthDate),
        gender: formData.gender,
        relationship: formData.relationship,
        holiday: formData.holiday,
        childGender: formData.holiday === Holiday.NEWBORN ? childGender : undefined
      };
  };

  // Helper to compress image before saving to storage to prevent QuotaExceededError
  const compressImage = async (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Resize to max 800px width/height to save space
            const maxDim = 800;
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > maxDim) {
                    height *= maxDim / width;
                    width = maxDim;
                }
            } else {
                if (height > maxDim) {
                    width *= maxDim / height;
                    height = maxDim;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                // Compress to JPEG 0.7 quality
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            } else {
                resolve(base64Str);
            }
        };
        img.onerror = () => resolve(base64Str);
    });
  };

  const handleInitialGenerate = async () => {
    if (!formData.name) return;
    if (formData.holiday === Holiday.BIRTHDAY && !formData.birthDate) return;

    setStep('generating');
    
    try {
      const requestData = getRequestData();

      // Use allSettled so if one fails, we still show the other
      const results = await Promise.allSettled([
        generateGreetingText(requestData),
        generateGreetingImage(requestData)
      ]);

      const textResult = results[0];
      const imageResult = results[1];

      let text = '';
      let imageUrl = '';

      if (textResult.status === 'fulfilled') {
          text = textResult.value;
      } else {
          console.error("Text generation failed", textResult.reason);
          text = `Поздравляю с праздником: ${formData.holiday}! Желаю всего самого наилучшего!`;
      }

      if (imageResult.status === 'fulfilled') {
          imageUrl = imageResult.value;
      } else {
          console.error("Image generation failed", imageResult.reason);
          // We leave imageUrl empty, UI will show retry button
      }

      setGeneratedText(text);
      setGeneratedImageUrl(imageUrl);
      setStep('result');
      
      // Initial Save
      const newCardId = Date.now().toString() + '_card';
      setCurrentCardId(newCardId);
      await saveToHistory(text, imageUrl, newCardId);
      
    } catch (e: any) {
      console.error(e);
      alert(`Произошла ошибка: ${e.message || 'Попробуйте еще раз'}.`);
      setStep('form');
    }
  };

  const handleRegenerateText = async () => {
      setIsRegeneratingText(true);
      try {
          const text = await generateGreetingText(getRequestData());
          setGeneratedText(text);
          await saveToHistory(text, generatedImageUrl, currentCardId);
      } catch (e) {
          console.error(e);
      } finally {
          setIsRegeneratingText(false);
      }
  };

  const handleRegenerateImage = async () => {
      setIsRegeneratingImage(true);
      try {
          const imageUrl = await generateGreetingImage(getRequestData());
          setGeneratedImageUrl(imageUrl);
          await saveToHistory(generatedText, imageUrl, currentCardId);
      } catch (e) {
          console.error(e);
          alert("Не удалось сгенерировать изображение. Попробуйте еще раз.");
      } finally {
          setIsRegeneratingImage(false);
      }
  };

  const saveToHistory = async (text: string, imageUrl: string, cardId: string) => {
      const age = calculateAge(formData.birthDate);
      // Ensure unique ID if no birthdate
      const personId = formData.name + '_' + (formData.birthDate || 'no_date'); 
      
      const person: PersonData = {
        id: personId,
        name: formData.name,
        birthDate: formData.birthDate || '', // DO NOT DEFAULT TO TODAY
        gender: formData.gender,
        relationship: formData.relationship as Relationship,
        age
      };
      
      // Compress image if it exists
      let storedImageUrl = imageUrl;
      if (imageUrl && imageUrl.startsWith('data:')) {
          storedImageUrl = await compressImage(imageUrl);
      }

      const card: GreetingCard = {
        id: cardId,
        personId,
        generatedText: text,
        generatedImageUrl: storedImageUrl,
        createdAt: Date.now(),
        holiday: formData.holiday
      };

      savePerson(person);
      saveCard(card);
  };

  const createCompositeImage = async (imageUrl: string, text: string): Promise<File | null> => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        // If no image, create a colored background
        if (!imageUrl) {
            // ... fallback logic could go here, but for now we assume image exists for sharing
            // or we draw a placeholder
        }

        img.crossOrigin = "anonymous";
        img.src = imageUrl;
        
        const render = () => {
             // Set canvas to 9:16 vertical HD
            const width = 1080;
            const height = 1920;
            canvas.width = width;
            canvas.height = height;
            
            if (!ctx) { resolve(null); return; }

            // 1. Fill Background White
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);

            // 2. Draw Image at Top (Square)
            // Image takes top 1080x1080
            if (imageUrl) {
                ctx.drawImage(img, 0, 0, width, width);
            } else {
                // Placeholder gradient if image failed
                const grad = ctx.createLinearGradient(0,0, width, width);
                grad.addColorStop(0, '#f3e8ff');
                grad.addColorStop(1, '#d8b4fe');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, width, width);
            }

            // 3. Draw Text Section at Bottom
            const textStartY = width + 50; // Start below image
            const textHeight = height - width;
            
            ctx.fillStyle = '#1f2937'; // Dark gray text
            ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            
            const maxWidth = width - 120; // Padding
            const lineHeight = 70;
            const words = text.split(' ');
            let line = '';
            const lines = [];

            for(let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                    lines.push(line);
                    line = words[n] + ' ';
                } else {
                    line = testLine;
                }
            }
            lines.push(line);

            // Center text vertically in the bottom space
            const totalTextHeight = lines.length * lineHeight;
            let y = textStartY + (textHeight - totalTextHeight) / 2 - 40; // slightly up

            // Safety clamp
            if (y < textStartY) y = textStartY + 20;

            for (let i = 0; i < lines.length; i++) {
                ctx.fillText(lines[i], width / 2, y + (i * lineHeight));
            }

            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], `card_${Date.now()}.png`, { type: 'image/png' });
                    resolve(file);
                } else {
                    resolve(null);
                }
            }, 'image/png');
        };

        if (imageUrl) {
            img.onload = render;
            img.onerror = () => {
                console.error("Failed to load image for compositing");
                render();
            };
        } else {
            render();
        }
    });
  };

  const handleShareComposite = async () => {
    if (!generatedText) return;

    try {
        const file = await createCompositeImage(generatedImageUrl, generatedText);
        if (!file) {
            alert("Ошибка создания открытки.");
            return;
        }

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file]
            });
        } else {
             alert("Ваше устройство не поддерживает отправку файлов. Скачиваем...");
             handleDownloadComposite();
        }
    } catch (e) {
        console.error("Sharing failed", e);
        alert("Не удалось открыть меню 'Поделиться'.");
    }
  };
  
  const handleDownloadComposite = async () => {
      const file = await createCompositeImage(generatedImageUrl, generatedText);
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

  const isFormValid = () => {
      if (!formData.name) return false;
      if (formData.holiday === Holiday.BIRTHDAY) {
          return !!formData.birthDate;
      }
      return true;
  };

  if (step === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-6">
        <div className="relative">
          <div className="absolute inset-0 bg-purple-200 rounded-full animate-ping opacity-75"></div>
          <div className="relative bg-white p-4 rounded-full shadow-xl">
            <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
          </div>
        </div>
        <h3 className="mt-8 text-xl font-bold text-gray-800">Магия происходит...</h3>
        <p className="mt-2 text-gray-500">ИИ рисует открытку и пишет текст</p>
      </div>
    );
  }

  if (step === 'result') {
    return (
      <div className="px-4 py-6 pb-24 space-y-6">
        {/* IMAGE SECTION */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-purple-100">
           <div className="relative aspect-square w-full bg-gray-100 group flex items-center justify-center">
             {isRegeneratingImage ? (
                 <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                     <Loader2 className="animate-spin text-purple-600" size={40} />
                 </div>
             ) : generatedImageUrl ? (
                 <img src={generatedImageUrl} alt="Greeting Card" className="w-full h-full object-cover" />
             ) : (
                 <div className="text-center p-6">
                     <div className="bg-purple-100 p-4 rounded-full inline-flex mb-2">
                        <ImageIcon size={32} className="text-purple-400" />
                     </div>
                     <p className="text-gray-400 text-sm mb-4">Не удалось создать изображение</p>
                     <button 
                        onClick={handleRegenerateImage}
                        className="text-purple-600 font-medium text-sm border border-purple-200 px-4 py-2 rounded-lg hover:bg-purple-50"
                     >
                        Попробовать снова
                     </button>
                 </div>
             )}
             
             {/* Action Buttons on Image */}
             {generatedImageUrl && (
                 <div className="absolute top-4 right-4 flex space-x-2">
                     <button 
                       onClick={handleRegenerateImage}
                       className="bg-white/90 p-2 rounded-full shadow-sm text-gray-700 hover:text-purple-600 transition-colors backdrop-blur-sm"
                       title="Сгенерировать другую картинку"
                     >
                       <RotateCw size={20} />
                     </button>
                 </div>
             )}
           </div>
        </div>

        {/* TEXT SECTION */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100 relative">
            <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                    <Pencil size={12} />
                    Текст поздравления
                </label>
                <button 
                   onClick={handleRegenerateText}
                   disabled={isRegeneratingText}
                   className="text-purple-600 text-xs font-medium flex items-center hover:bg-purple-50 px-2 py-1 rounded-lg transition-colors"
                >
                   {isRegeneratingText ? <Loader2 className="animate-spin mr-1" size={12}/> : <RotateCw size={12} className="mr-1" />}
                   Другой текст
                </button>
            </div>
            
            {isRegeneratingText ? (
                <div className="h-32 flex items-center justify-center text-gray-400">
                    <Loader2 className="animate-spin" />
                </div>
            ) : (
                <textarea 
                    value={generatedText}
                    onChange={(e) => setGeneratedText(e.target.value)}
                    className="w-full h-32 text-gray-700 text-lg leading-relaxed resize-none outline-none bg-transparent placeholder-gray-300"
                    placeholder="Текст поздравления..."
                />
            )}
        </div>

        {/* MAIN ACTION */}
        <div className="flex flex-col space-y-3">
          <button 
              onClick={handleShareComposite}
              className="flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg active:scale-95 transition-transform"
          >
              <Share2 size={20} />
              <span>Отправить открытку</span>
          </button>
          <p className="text-xs text-center text-gray-400">
              Картинка и текст объединятся в одно изображение
          </p>
        </div>
        
        {/* DOWNLOAD BUTTON (AUXILIARY) */}
         <button 
              onClick={handleDownloadComposite}
              className="w-full flex items-center justify-center space-x-2 text-gray-500 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
              <Download size={18} />
              <span>Скачать на устройство</span>
          </button>

        <button 
          onClick={onSuccess}
          className="w-full text-gray-400 py-2 text-sm font-medium hover:text-gray-600"
        >
          Вернуться на главную
        </button>
      </div>
    );
  };

  return (
    <div className="px-4 py-6 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Создать поздравление</h1>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Какой праздник?</label>
          <div className="relative">
            <select 
                value={formData.holiday}
                onChange={(e) => setFormData({...formData, holiday: e.target.value as Holiday})}
                className="w-full px-4 py-3 rounded-xl border-gray-200 border bg-white focus:ring-2 focus:ring-purple-500 outline-none appearance-none pr-10"
            >
                {(Object.values(Holiday) as Holiday[]).map((h) => (
                <option key={h} value={h}>{h}</option>
                ))}
            </select>
            <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
          </div>
        </div>
        
        {/* NEWBORN GENDER SELECTOR */}
        {formData.holiday === Holiday.NEWBORN && (
             <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 animate-in fade-in zoom-in duration-300">
                <label className="block text-sm font-bold text-purple-800 mb-2 flex items-center gap-2">
                    <Baby size={18} />
                    Кто родился?
                </label>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setChildGender(Gender.MALE)}
                        className={`py-2 rounded-lg border text-sm font-medium transition-all ${
                            childGender === Gender.MALE 
                            ? 'bg-blue-500 text-white border-blue-600 shadow-md' 
                            : 'bg-white text-gray-600 border-gray-200'
                        }`}
                    >
                        Мальчик
                    </button>
                    <button
                        onClick={() => setChildGender(Gender.FEMALE)}
                        className={`py-2 rounded-lg border text-sm font-medium transition-all ${
                            childGender === Gender.FEMALE
                            ? 'bg-pink-500 text-white border-pink-600 shadow-md' 
                            : 'bg-white text-gray-600 border-gray-200'
                        }`}
                    >
                        Девочка
                    </button>
                </div>
             </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Кого поздравляем?</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="Имя (например, Иван)"
            className="w-full px-4 py-3 rounded-xl border-gray-200 border bg-white focus:ring-2 focus:ring-purple-500 outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
             Дата рождения
             {formData.holiday !== Holiday.BIRTHDAY && <span className="text-gray-400 font-normal ml-1">(необязательно)</span>}
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              placeholder="ДД.ММ.ГГГГ"
              maxLength={10}
              value={dateInputValue}
              onChange={handleDateChange}
              className="w-full px-4 py-3 rounded-xl border-gray-200 border bg-white focus:ring-2 focus:ring-purple-500 outline-none placeholder-gray-400 tracking-wider"
            />
            <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
          </div>
          <p className="text-xs text-gray-400 mt-1 ml-1">Введите только цифры, точки добавятся сами</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Пол получателя</label>
          <div className="grid grid-cols-2 gap-3">
            {(Object.values(Gender) as Gender[]).map((g) => (
              <button
                key={g}
                onClick={() => setFormData({...formData, gender: g})}
                className={`py-3 rounded-xl border transition-all ${
                  formData.gender === g 
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Кем приходится?</label>
          <select 
            value={formData.relationship}
            onChange={(e) => setFormData({...formData, relationship: e.target.value as Relationship})}
            className="w-full px-4 py-3 rounded-xl border-gray-200 border bg-white focus:ring-2 focus:ring-purple-500 outline-none"
          >
            {(Object.values(Relationship) as Relationship[]).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleInitialGenerate}
          disabled={!isFormValid()}
          className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center space-x-2 transition-all mt-8 ${
            !isFormValid()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white active:scale-95'
          }`}
        >
          <Sparkles size={20} />
          <span>Сгенерировать</span>
        </button>
      </div>
    </div>
  );
};