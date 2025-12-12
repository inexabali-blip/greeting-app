export enum Gender {
  MALE = 'Мужской',
  FEMALE = 'Женский'
}

export enum Relationship {
  FRIEND = 'Друг/Подруга',
  PARTNER = 'Партнер/Супруг(а)',
  PARENT = 'Родитель',
  CHILD = 'Ребенок',
  GRANDPARENT = 'Дедушка/Бабушка',
  GRANDCHILD = 'Внук/Внучка',
  COLLEAGUE = 'Коллега',
  RELATIVE = 'Родственник',
  OTHER = 'Другое'
}

export enum Holiday {
  BIRTHDAY = 'День рождения',
  NEW_YEAR = 'Новый год',
  CHRISTMAS = 'Рождество',
  VALENTINES_DAY = 'День святого Валентина',
  WOMENS_DAY = '8 Марта',
  MENS_DAY = '23 Февраля',
  ANNIVERSARY = 'Юбилей',
  WEDDING = 'Свадьба',
  NEWBORN = 'Рождение ребенка',
  GRADUATION = 'Выпускной',
  PROMOTION = 'Повышение',
  NEW_PROJECT = 'Новый проект'
}

export interface PersonData {
  id: string;
  name: string;
  birthDate: string; // ISO date string YYYY-MM-DD or empty string
  gender: Gender;
  relationship: Relationship;
  age: number; // Derived or manually entered if date unknown
}

export interface GreetingCard {
  id: string;
  personId: string;
  generatedText: string;
  generatedImageUrl: string;
  createdAt: number;
  holiday: Holiday; // Added to track context
}

// Combined type for the UI
export interface SavedGreeting extends PersonData {
  latestCard?: GreetingCard;
}

export interface GenerateRequest {
  name: string;
  gender: Gender;
  age: number;
  relationship: string;
  holiday: Holiday;
  childGender?: Gender; // Optional field for newborn gender
  tone?: string;
}