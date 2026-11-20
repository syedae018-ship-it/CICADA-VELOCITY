import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8 bg-neutral-50 font-sans">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  );
}
