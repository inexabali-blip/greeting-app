import { SavedGreeting, GreetingCard, PersonData } from "../types";

const PEOPLE_KEY = 'congratulator_people';
const CARDS_KEY = 'congratulator_cards';

// Helper to handle storage quotas
const safeSetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e: any) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      // Storage is full. Try to clear old cards.
      console.warn("Storage quota exceeded. Attempting to cleanup old cards.");
      if (key === CARDS_KEY) {
         pruneOldCards(value); // Try to save the new cards list after pruning
      } else {
         // If people list is too big (unlikely), we just can't save.
         console.error("Cannot save data: Storage full.");
         throw e;
      }
    } else {
      throw e;
    }
  }
};

// Removes oldest cards to free space until save works
const pruneOldCards = (pendingCardsJson: string) => {
  try {
    // 1. Get current stored raw string to parse current state (if possible) or just use the current implementation of getCards
    const currentCards = getCards();
    
    // Sort by date (oldest first)
    currentCards.sort((a, b) => a.createdAt - b.createdAt);
    
    // We need to free up space. Let's delete 20% of oldest cards or at least 1.
    const deleteCount = Math.max(1, Math.floor(currentCards.length * 0.2));
    
    // Keep newer cards
    const keptCards = currentCards.slice(deleteCount);
    
    // Note: The 'pendingCardsJson' passed here is likely the NEW list that failed to save. 
    // This logic is tricky because we are inside the failure of saving the NEW list.
    // Simpler strategy:
    // If saving failed, we assume 'value' was the full new list. 
    // We should parse 'value', sort it, remove oldest, and try saving again.
    
    const cardsToSave: GreetingCard[] = JSON.parse(pendingCardsJson);
    if (cardsToSave.length <= 1) return; // Can't delete if only 1 exists
    
    // Sort oldest first to remove them
    cardsToSave.sort((a, b) => a.createdAt - b.createdAt);
    
    // Remove oldest
    cardsToSave.shift(); 
    
    // Try saving again
    localStorage.setItem(CARDS_KEY, JSON.stringify(cardsToSave));
    
  } catch (e) {
    console.error("Failed to prune storage", e);
    // If still failing, we surrender.
  }
};

export const savePerson = (person: PersonData) => {
  try {
    const people = getPeople();
    const existingIndex = people.findIndex(p => p.id === person.id);
    
    if (existingIndex >= 0) {
      people[existingIndex] = person;
    } else {
      people.push(person);
    }
    
    safeSetItem(PEOPLE_KEY, JSON.stringify(people));
  } catch (e) {
    console.error("Failed to save person", e);
  }
};

export const getPeople = (): PersonData[] => {
  try {
    const data = localStorage.getItem(PEOPLE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load people", e);
    return [];
  }
};

export const saveCard = (card: GreetingCard) => {
  try {
    const cards = getCards();
    // Check if updating existing card
    const existingIndex = cards.findIndex(c => c.id === card.id);
    if (existingIndex >= 0) {
        cards[existingIndex] = card;
    } else {
        cards.push(card);
    }
    safeSetItem(CARDS_KEY, JSON.stringify(cards));
  } catch (e) {
    console.error("Failed to save card", e);
  }
};

export const getCards = (): GreetingCard[] => {
  try {
    const data = localStorage.getItem(CARDS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load cards", e);
    return [];
  }
};

export const getFullHistory = (): SavedGreeting[] => {
  const people = getPeople();
  const cards = getCards();

  return people.map(person => {
    // Find latest card for this person
    const personCards = cards.filter(c => c.personId === person.id);
    const latestCard = personCards.sort((a, b) => b.createdAt - a.createdAt)[0];
    
    return {
      ...person,
      latestCard
    };
  }).sort((a, b) => {
      return a.name.localeCompare(b.name);
  });
};

export const deletePerson = (id: string) => {
  try {
    let people = getPeople();
    people = people.filter(p => p.id !== id);
    safeSetItem(PEOPLE_KEY, JSON.stringify(people));
    
    // Cleanup cards
    let cards = getCards();
    cards = cards.filter(c => c.personId !== id);
    safeSetItem(CARDS_KEY, JSON.stringify(cards));
  } catch (e) {
    console.error("Delete failed", e);
  }
};