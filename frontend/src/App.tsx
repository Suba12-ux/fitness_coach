import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { AuthScreen } from "./components/AuthScreen";
import { Brand } from "./components/Navigation";
import { IconRefresh } from "./components/Icons";
import { useTheme } from "./hooks/useTheme";
import Workspace from "./pages/Workspace";

function SessionSplash() {
  useTheme();

  return (
    <div className="auth-shell auth-shell--center">
      <div className="auth-boot card" aria-busy="true">
        <Brand />
        <span className="status status--info">
          <span className="spinner" aria-hidden="true" />
          Проверяем сессию
        </span>
      </div>
    </div>
  );
}

function OfflineScreen({ onRetry }: { onRetry: () => void }) {
  useTheme();

  return (
    <div className="auth-shell auth-shell--center">
      <div className="auth-boot card">
        <Brand />
        <h1>Нет связи с сервером</h1>
        <p>
          Не удалось проверить вход в аккаунт. Убедитесь, что backend запущен,
          и повторите попытку.
        </p>
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          <IconRefresh />
          Повторить
        </button>
      </div>
    </div>
  );
}

function Gate() {
  const auth = useAuth();

  if (auth.status === "loading") {
    return <SessionSplash />;
  }
  if (auth.status === "offline") {
    return <OfflineScreen onRetry={auth.retry} />;
  }
  if (auth.status === "anonymous") {
    return <AuthScreen />;
  }
  return <Workspace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
