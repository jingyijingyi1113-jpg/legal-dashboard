import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { cn } from '@/lib/utils';

interface LoginPageProps {
  onSwitchToRegister: () => void;
}

export function LoginPage({ onSwitchToRegister }: LoginPageProps) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(formData);
      if (!result.success) {
        setError(result.message);
      }
    } catch (err) {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#f8fafc]">
      {/* Language Switcher - Top Right */}
      <div className="absolute top-6 right-6 z-20">
        <LanguageSwitcher variant="icon" />
      </div>

      {/* Animated gradient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/30" />
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-blue-100/60 to-indigo-100/40 blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-cyan-100/50 to-blue-100/30 blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '1s' }} />
          <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] rounded-full bg-gradient-to-r from-violet-100/30 to-fuchsia-100/20 blur-3xl animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        </div>
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
      </div>

      <div className="relative z-10 w-full max-w-[420px] px-6">
        {/* Logo and title with refined animation */}
        <div className="text-center mb-10 animate-fade-in-down">
          {/* Title with icon inline - centered properly */}
          <div className="inline-flex items-center justify-center gap-3 mb-3 -ml-3">
            {/* Icon container */}
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 w-11 h-11 rounded-xl bg-gradient-to-br from-blue-400/20 to-indigo-500/20 blur-lg" />
              <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 shadow-xl shadow-blue-500/30 flex items-center justify-center">
                {/* Clipboard with chart icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  <path d="M9 14v3" />
                  <path d="M12 12v5" />
                  <path d="M15 10v7" />
                </svg>
              </div>
            </div>
            
            <h1 className="text-[26px] font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-clip-text text-transparent tracking-tight whitespace-nowrap">
              {t('auth.loginTitle')}
            </h1>
          </div>
          
          <p className="text-slate-500 text-[15px] font-medium">{t('auth.loginSubtitle')}</p>
        </div>

        {/* Login form card with glass morphism */}
        <div className="relative animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          {/* Card shadow layers for depth */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/80 to-white/60 rounded-3xl blur-xl transform translate-y-4 scale-[0.98]" />
          
          <div className="relative bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] border border-white/80 p-8 overflow-hidden">
            {/* Decorative top gradient line */}
            <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Username field */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  {t('auth.username')}
                </label>
                <div className={cn(
                  "relative rounded-xl transition-all duration-300",
                  focusedField === 'username' && "ring-2 ring-blue-500/20"
                )}>
                  <Input
                    type="text"
                    placeholder={t('auth.username')}
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full h-12 px-4 rounded-xl border-slate-200/80 bg-slate-50/50 focus:bg-white focus:border-blue-400 transition-all duration-200 text-[15px]"
                    required
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  {t('auth.password')}
                </label>
                <div className={cn(
                  "relative rounded-xl transition-all duration-300",
                  focusedField === 'password' && "ring-2 ring-blue-500/20"
                )}>
                  <Input
                    type="password"
                    placeholder={t('auth.password')}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full h-12 px-4 rounded-xl border-slate-200/80 bg-slate-50/50 focus:bg-white focus:border-blue-400 transition-all duration-200 text-[15px]"
                    required
                  />
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-3 text-sm text-red-600 bg-red-50/80 backdrop-blur-sm px-4 py-3.5 rounded-xl border border-red-100 animate-shake">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  </div>
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {/* Submit button */}
              <Button
                type="submit"
                disabled={loading}
                className={cn(
                  "relative w-full h-12 rounded-xl font-semibold text-[15px] text-white overflow-hidden",
                  "bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600",
                  "shadow-lg shadow-blue-500/30",
                  "transition-all duration-300",
                  "hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02]",
                  "active:scale-[0.98]",
                  loading && "opacity-80 cursor-not-allowed hover:scale-100"
                )}
              >
                {/* Button shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
                
                {loading ? (
                  <span className="relative flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('auth.loggingIn')}
                  </span>
                ) : (
                  <span className="relative flex items-center justify-center gap-2">
                    {t('auth.loginButton')}
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14"/>
                      <path d="m12 5 7 7-7 7"/>
                    </svg>
                  </span>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200/60" />
              </div>
            </div>

            {/* Register link */}
            <div className="text-center">
              <p className="text-[15px] text-slate-500">
                {t('auth.noAccount')}
                <span className="ml-1.5 text-blue-600 font-semibold">
                  ivyjyding
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
