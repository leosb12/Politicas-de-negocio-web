import { Usuario } from '../../../core/auth/models/usuario.model';

export interface ProfileSummaryItem {
  label: string;
  value: string;
}

export interface ProfilePageConfig {
  theme: 'admin' | 'funcionario';
  badgeLabel: string;
  heroTitle: string;
  heroDescription: string;
  securityDescription: string;
  note: string;
  actionHint: string;
  user: Usuario | null;
  summaryItems: ProfileSummaryItem[];
}
