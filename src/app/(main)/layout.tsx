import { BottomNav } from "@/components/layout/BottomNav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh flex flex-col">
      <main className="min-w-0 flex-1 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]">{children}</main>
      <BottomNav />
    </div>
  );
}
