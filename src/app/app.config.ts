import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { adminUserHeaderInterceptor } from './core/interceptors/admin-user-header.interceptor';
import { adminAuthErrorInterceptor } from './core/interceptors/admin-auth-error.interceptor';
import { LucideAngularModule, Settings2, Plus, Search, ClipboardList, RefreshCw, CheckCircle2, Pencil, PauseCircle, CircleDot, Link, X, Rocket, Sparkles, Play, Square, Diamond, Split, Merge, StopCircle, Lightbulb, Folder, Shuffle, Check, Save, Trash2, ZoomIn, ZoomOut, Focus, PlayCircle, ArrowLeft } from 'lucide-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([adminUserHeaderInterceptor, adminAuthErrorInterceptor])
    ),
    importProvidersFrom(
      LucideAngularModule.pick({
        Settings2, Plus, Search, ClipboardList, RefreshCw, CheckCircle2, Pencil, PauseCircle, CircleDot, Link, X, Rocket, Sparkles, Play, Square, Diamond, Split, Merge, StopCircle, Lightbulb, Folder, Shuffle, Check, Save, Trash2, ZoomIn, ZoomOut, Focus, PlayCircle, ArrowLeft
      })
    )
  ]
};