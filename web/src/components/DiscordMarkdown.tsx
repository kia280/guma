'use client';

import { useTranslations } from 'next-intl';
import React from 'react';
import { parseDiscordMarkdown, type BlockNode, type InlineNode, type ListBlock } from '@/lib/discord-markdown';

function Spoiler({ children }: { children: React.ReactNode }) {
  const t = useTranslations('markdown');
  const [revealed, setRevealed] = React.useState(false);

  if (revealed) {
    return <span className="rounded bg-surface-tertiary px-0.5">{children}</span>;
  }
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={t('revealSpoiler')}
      className="cursor-pointer rounded bg-default px-0.5 text-transparent select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&_*]:text-transparent"
      onClick={() => setRevealed(true)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setRevealed(true);
        }
      }}
    >
      <span aria-hidden>{children}</span>
    </span>
  );
}

function renderInline(nodes: InlineNode[]): React.ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'text':
        return <React.Fragment key={index}>{node.value}</React.Fragment>;
      case 'br':
        return <br key={index} />;
      case 'code':
        return (
          <code key={index} className="rounded bg-surface-secondary px-1 py-0.5 font-mono">
            {node.value}
          </code>
        );
      case 'bold':
        return <strong key={index} className="font-semibold">{renderInline(node.children)}</strong>;
      case 'italic':
        return <em key={index}>{renderInline(node.children)}</em>;
      case 'underline':
        return <u key={index} className="underline-offset-2">{renderInline(node.children)}</u>;
      case 'strike':
        return <s key={index}>{renderInline(node.children)}</s>;
      case 'spoiler':
        return <Spoiler key={index}>{renderInline(node.children)}</Spoiler>;
      case 'link':
        return (
          <a
            key={index}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-accent underline underline-offset-2 break-all hover:opacity-80"
          >
            {renderInline(node.children)}
          </a>
        );
    }
  });
}

function renderList(list: ListBlock, key: React.Key): React.ReactNode {
  const items = list.items.map((item, index) => (
    <li key={index}>
      {renderInline(item.children)}
      {item.sublist && renderList(item.sublist, 'sublist')}
    </li>
  ));
  return list.ordered
    ? <ol key={key} start={list.start} className="list-decimal pl-6 space-y-0.5">{items}</ol>
    : <ul key={key} className="list-disc pl-6 space-y-0.5">{items}</ul>;
}

const HEADING_CLASS = {
  1: 'type-title text-foreground',
  2: 'type-heading text-foreground',
  3: 'type-subheading text-foreground',
} as const;

function renderBlocks(blocks: BlockNode[]): React.ReactNode[] {
  return blocks.map((block, index) => {
    switch (block.type) {
      case 'paragraph':
        return <p key={index}>{renderInline(block.children)}</p>;
      case 'heading': {
        const Tag = (`h${block.level + 2}`) as 'h3' | 'h4' | 'h5';
        return <Tag key={index} className={HEADING_CLASS[block.level]}>{renderInline(block.children)}</Tag>;
      }
      case 'subtext':
        return <p key={index} className="type-caption text-hint">{renderInline(block.children)}</p>;
      case 'quote':
        return (
          <blockquote key={index} className="border-l-4 border-divider pl-3 space-y-2">
            {renderBlocks(block.children)}
          </blockquote>
        );
      case 'codeBlock':
        return (
          <pre
            key={index}
            data-language={block.language || undefined}
            className="overflow-x-auto rounded-lg border border-divider bg-surface-secondary p-3 type-caption text-foreground"
          >
            <code className="font-mono">{block.value}</code>
          </pre>
        );
      case 'list':
        return renderList(block, index);
    }
  });
}

export function DiscordMarkdown({ content, className }: { content: string; className?: string }) {
  const blocks = React.useMemo(() => parseDiscordMarkdown(content), [content]);
  return <div className={`space-y-2 break-words ${className ?? ''}`}>{renderBlocks(blocks)}</div>;
}
