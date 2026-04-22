import ChatClient from './ChatClient';

export const dynamic = 'force-dynamic';

export default function ChatPage() {
  return (
    <div className="chat-page">
      <ChatClient />
    </div>
  );
}
