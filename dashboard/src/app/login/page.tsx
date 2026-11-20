import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.2),rgba(255,255,255,0))]" />
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  );
}
