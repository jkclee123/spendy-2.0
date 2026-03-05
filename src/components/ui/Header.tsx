import { NavigationLink } from "@/components/ui/NavigationLink";

export function Header() {
  return (
    <header className="bg-gray-100 dark:bg-gray-950 lg:pl-20">
      <div className="mx-auto flex h-[3.2rem] max-w-4xl items-center justify-center px-4">
        <NavigationLink href="/transactions" className="flex items-center gap-2">
          <h1 className="text-3xl font-[1000] font-dancing-script text-black dark:text-white">
            Spendy
          </h1>
        </NavigationLink>
      </div>
    </header>
  );
}
