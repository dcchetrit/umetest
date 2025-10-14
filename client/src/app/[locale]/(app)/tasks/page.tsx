import TasksClient from './TasksClient';

export default async function TasksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return <TasksClient locale={locale} />;
}