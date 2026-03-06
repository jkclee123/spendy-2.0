interface PageHeaderProps {
  title: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <div className={`mx-4 flex items-center mb-5 ${action ? "justify-between" : ""}`}>
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-200">{title}</h2>
      {action}
    </div>
  );
}
