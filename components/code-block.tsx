'use client';

interface CodeBlockProps {
  node: any;
  inline: boolean;
  className: string;
  children: any;
}

export function CodeBlock({
  node,
  inline,
  className,
  children,
  ...props
}: CodeBlockProps) {
  if (!inline) {
    return (
      <div className="not-prose flex flex-col">
        <pre
          {...props}
          className={`text-sm w-full overflow-x-auto dark:bg-zinc-900 p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl dark:text-zinc-50 text-zinc-900`}
        >
          <code className="whitespace-pre-wrap break-words">{children}</code>
        </pre>
      </div>
    );
  } else {
    // 检测内容是否可能是哈希值或地址（以0x开头的长字符串）
    const content = String(children);
    const isHashOrAddress = content.startsWith('0x') && content.length > 10;
    
    return (
      <code
        className={`${className} text-sm ${isHashOrAddress ? 'font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700' : 'bg-zinc-100 dark:bg-zinc-800'} py-0.5 px-1.5 rounded-md break-all max-w-full inline-block overflow-hidden`}
        {...props}
      >
        {children}
      </code>
    );
  }
}
