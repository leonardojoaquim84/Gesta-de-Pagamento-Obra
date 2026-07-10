
export enum WorkerType {
  PEDREIRO = 'Pedreiro',
  AJUDANTE = 'Ajudante'
}

export interface Attendance {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
}

export interface Worker {
  id: string;
  name: string;
  role: WorkerType;
  dailyRate: number;
  attendance: Attendance;
  hasAdvance?: boolean;
  advanceDays?: number;
  customAdvanceValue?: number;
  hasDeduction?: boolean;
  deductionDays?: number;
  customDeductionValue?: number;
}

export interface WeeklyPayment {
  id: string;
  startDate: string;
  endDate: string;
  workers: Worker[];
  totalAmount: number;
}

export interface MaterialItem {
  id: string;
  name: string;
  quantity: string;
  checked: boolean;
  createdAt: number;
}

export const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Seg' },
  { key: 'tuesday', label: 'Ter' },
  { key: 'wednesday', label: 'Qua' },
  { key: 'thursday', label: 'Qui' },
  { key: 'friday', label: 'Sex' },
  { key: 'saturday', label: 'Sáb' },
] as const;
