export type ReportType = 'bug' | 'feature' | 'feedback';

export interface ReportFormData {
    title: string;
    description: string;
    type: ReportType;
    screenshot?: string;
}

export interface TrelloCardPayload {
  name: string;
  desc: string;
  idList: string;
  urlSource?: string;
}