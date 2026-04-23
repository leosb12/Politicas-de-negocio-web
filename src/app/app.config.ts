import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { adminUserHeaderInterceptor } from './core/interceptors/admin-user-header.interceptor';
import { adminAuthErrorInterceptor } from './core/interceptors/admin-auth-error.interceptor';
import { funcionarioUserHeaderInterceptor } from './core/interceptors/funcionario-user-header.interceptor';
import { funcionarioAuthErrorInterceptor } from './core/interceptors/funcionario-auth-error.interceptor';
import {
  LucideAngularModule,
  Settings2,
  Plus,
  Search,
  ClipboardList,
  RefreshCw,
  CheckCircle2,
  Pencil,
  PauseCircle,
  CircleDot,
  Link,
  X,
  Rocket,
  Sparkles,
  Play,
  Square,
  Diamond,
  Split,
  Merge,
  StopCircle,
  Lightbulb,
  Folder,
  Shuffle,
  Check,
  Save,
  Trash2,
  ZoomIn,
  ZoomOut,
  Focus,
  PlayCircle,
  ArrowLeft,
  ArrowUpDown,
  ArrowLeftRight,
  Users,
  Wifi,
  WifiOff,
  AlertTriangle,
  AlertCircle,
  CloudCheck,
  User,
  UserCheck,
  Ban,
  Zap,
  Info,
} from 'lucide-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([
        adminUserHeaderInterceptor,
        funcionarioUserHeaderInterceptor,
        adminAuthErrorInterceptor,
        funcionarioAuthErrorInterceptor,
      ])
    ),
    importProvidersFrom(
      LucideAngularModule.pick({
        Settings2,
        Plus,
        Search,
        ClipboardList,
        RefreshCw,
        CheckCircle2,
        Pencil,
        PauseCircle,
        CircleDot,
        Link,
        X,
        Rocket,
        Sparkles,
        Play,
        Square,
        Diamond,
        Split,
        Merge,
        StopCircle,
        Lightbulb,
        Folder,
        Shuffle,
        Check,
        Save,
        Trash2,
        ZoomIn,
        ZoomOut,
        Focus,
        PlayCircle,
        ArrowLeft,
        ArrowUpDown,
        ArrowLeftRight,
        Users,
        User,
        Wifi,
        WifiOff,
        AlertTriangle,
        AlertCircle,
        CloudCheck,
        UserCheck,
        Ban,
      })
    )
  ]
};