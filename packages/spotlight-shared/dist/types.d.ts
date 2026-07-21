export interface SubFieldConfig {
    id: string;
    subtext: string;
    placeholder?: string;
}
export interface FieldConfig {
    id: string;
    type: 'text' | 'email' | 'textarea' | 'file' | 'composite';
    label: string;
    subtext?: string;
    placeholder?: string;
    required: boolean;
    accept?: string;
    subFields?: SubFieldConfig[];
}
export interface SectionConfig {
    id: string;
    title: string;
    fields: FieldConfig[];
}
export interface FormConfig {
    title: string;
    subtitle: string;
    sections: SectionConfig[];
}
export interface SubmissionFile {
    name: string;
    size: number;
    type: string;
    dataUrl?: string;
}
export interface Submission {
    id: string;
    timestamp: string;
    data: Record<string, string>;
    files: Record<string, SubmissionFile>;
    includePayouts: boolean;
    payoutData?: {
        accountName: string;
        bankName: string;
        accountNumber: string;
    };
}
