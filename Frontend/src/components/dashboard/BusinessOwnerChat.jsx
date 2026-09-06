'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, X } from 'lucide-react';

import api from '@/lib/api';

const initialMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Ask me about sales, purchases, profit, cash, or outstanding balances.',
};

function createConversationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `business-owner-${crypto.randomUUID()}`;
  }
  return `business-owner-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function renderInlineMarkdown(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, partIndex) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${partIndex}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={`${part}-${partIndex}`}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={`${part}-${partIndex}`}>{part.replaceAll('`', '')}</React.Fragment>;
  });
}

function parseTableRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function renderAssistantContent(content) {
  const lines = content.split('\n');
  const rendered = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const nextLine = lines[lineIndex + 1];

    if (line.includes('|') && nextLine && isTableSeparator(nextLine)) {
      const headers = parseTableRow(line);
      const rows = [];
      lineIndex += 2;
      while (lineIndex < lines.length && lines[lineIndex].includes('|') && lines[lineIndex].trim()) {
        rows.push(parseTableRow(lines[lineIndex]));
        lineIndex += 1;
      }
      lineIndex -= 1;
      rendered.push(
        <div className="owner-chat-table-wrap" key={`table-${lineIndex}`}>
          <table className="owner-chat-table">
            <thead><tr>{headers.map((header) => <th key={header}>{renderInlineMarkdown(header)}</th>)}</tr></thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {headers.map((_, cellIndex) => <td key={`cell-${rowIndex}-${cellIndex}`}>{renderInlineMarkdown(row[cellIndex] || '')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (!line.trim()) {
      rendered.push(<div className="owner-chat-spacer" key={`spacer-${lineIndex}`} />);
    } else if (/^#{1,3}\s/.test(line)) {
      rendered.push(<h3 key={`heading-${lineIndex}`}>{renderInlineMarkdown(line.replace(/^#{1,3}\s/, ''))}</h3>);
    } else if (/^[-*]\s/.test(line)) {
      rendered.push(<div className="owner-chat-list-item" key={`list-${lineIndex}`}><span>•</span>{renderInlineMarkdown(line.replace(/^[-*]\s/, ''))}</div>);
    } else {
      rendered.push(<div key={`line-${lineIndex}`}>{renderInlineMarkdown(line)}</div>);
    }
  }

  return rendered;
}

export default function BusinessOwnerChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([initialMessage]);
  const [isSending, setIsSending] = useState(false);
  const [isCheckingMessage, setIsCheckingMessage] = useState(false);
  const [messageSafetyError, setMessageSafetyError] = useState('');
  const inputRef = useRef(null);
  const messagesRef = useRef(null);
  const conversationIdRef = useRef(createConversationId());

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    const container = messagesRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, isSending]);

  async function submitMessage(event) {
    event?.preventDefault();
    const content = message.trim();
    if (!content || isSending || isCheckingMessage) return;

    setMessageSafetyError('');
    setIsCheckingMessage(true);

    try {
      const moderation = await api.post('/ai/predict-comment', { comment: content });
      const moderationResult = moderation.data || moderation;
      if (moderationResult.is_toxic === true) {
        setMessages((current) => [
          ...current,
          {
            id: `${Date.now()}-moderation`,
            role: 'error',
            content: 'This message cannot be sent because it contains inappropriate language.',
          },
        ]);
        return;
      }

      setMessage('');
      setMessages((current) => [
        ...current,
        { id: `${Date.now()}-user`, role: 'user', content },
      ]);
      setIsSending(true);
      const result = await api.post('/ai/chat', {
        message: content,
        conversation_id: conversationIdRef.current,
      });
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          content: result.response || 'I could not prepare an answer from the accounting data.',
        },
      ]);
    } catch (error) {
      setMessageSafetyError(error?.message || 'Message safety check is unavailable. Try again.');
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-error`,
          role: 'error',
          content: error?.message || 'The accounting assistant is unavailable right now.',
        },
      ]);
    } finally {
      setIsCheckingMessage(false);
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="owner-chat" aria-live="polite">
      {isOpen && (
        <section className="owner-chat-panel" role="dialog" aria-modal="false" aria-labelledby="owner-chat-title">
          <header className="owner-chat-header">
            <div className="owner-chat-title-wrap">
              <span className="owner-chat-avatar" aria-hidden="true"><Bot size={18} /></span>
              <div>
                <h2 id="owner-chat-title">Accounting assistant</h2>
                <span className="owner-chat-status"><i /> Connected to your books</span>
              </div>
            </div>
            <button
              type="button"
              className="owner-chat-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close accounting assistant"
              title="Close"
            >
              <X size={17} />
            </button>
          </header>

          <div className="owner-chat-messages" ref={messagesRef}>
            {messages.map((item) => (
              <div key={item.id} className={`owner-chat-message owner-chat-message-${item.role}`}>
                {item.role === 'assistant' ? renderAssistantContent(item.content) : item.content}
              </div>
            ))}
            {isSending && (
              <div className="owner-chat-message owner-chat-message-assistant owner-chat-typing" aria-label="Assistant is thinking">
                <span /><span /><span />
              </div>
            )}
          </div>

          <form className="owner-chat-form" onSubmit={submitMessage}>
            <input
              ref={inputRef}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask a financial question..."
              aria-label="Ask the accounting assistant"
              disabled={isSending || isCheckingMessage}
            />
            <button
              type="submit"
              className="owner-chat-send"
              disabled={!message.trim() || isSending || isCheckingMessage}
              aria-label="Send question"
              title="Send question"
            >
              <Send size={16} />
            </button>
          </form>
          {messageSafetyError && (
            <div className="owner-chat-input-error" role="alert">
              {messageSafetyError}
            </div>
          )}
        </section>
      )}

      <button
        type="button"
        className={`owner-chat-launcher${isOpen ? ' is-open' : ''}`}
        onClick={() => setIsOpen((current) => !current)}
        aria-label={isOpen ? 'Close accounting assistant' : 'Open accounting assistant'}
        aria-expanded={isOpen}
        title="Accounting assistant"
      >
        {isOpen ? <X size={23} /> : <MessageCircle size={24} />}
        {!isOpen && <span className="owner-chat-launcher-ping" aria-hidden="true" />}
      </button>
    </div>
  );
}
