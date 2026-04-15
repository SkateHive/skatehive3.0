export type ReportType = 'bug' | 'feature' | 'feedback';

export interface ReportFormData {
    title: string;
    description: string;
    type: ReportType;
    screenshot?: string;
    errorStack?: string;
    pageUrl?: string;
    userAgent?: string;
    reporter?: string;
}

export interface TrelloCardPayload {
  name: string;
  desc: string;
  idList: string;
  urlSource?: string;
}

export interface ReportOptions {
  type?: ReportType;
  prefillTitle?: string;
  prefillDescription?: string;
  errorStack?: string;
}