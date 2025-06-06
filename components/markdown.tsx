import Link from 'next/link';
import React, { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './code-block';

const components: Partial<Components> = {
  // @ts-expect-error
  code: CodeBlock,
  pre: ({ children }) => <>{children}</>,
  // 自定义p标签的渲染方式，处理hydration错误
  p: ({ node, children, ...props }) => {
    // 检查children是否包含pre标签
    const hasPreTag = React.Children.toArray(children).some(
      child => React.isValidElement(child) && child.type === 'pre'
    );
    
    // 如果包含pre标签，则直接返回children而不包装在p标签中
    if (hasPreTag) {
      return <>{children}</>;
    }
    
    // 正常情况下返回p标签，添加overflow-wrap以处理长文本，减少段落间距
    return <p className="overflow-wrap-anywhere max-w-full overflow-hidden my-1" {...props}>{children}</p>;
  },
  ol: ({ node, children, ...props }) => {
    return (
      <ol className="list-decimal list-outside ml-4 max-w-full overflow-hidden" {...props}>
        {children}
      </ol>
    );
  },
  li: ({ node, children, ...props }) => {
    return (
      <li className="py-1 overflow-wrap-anywhere max-w-full overflow-hidden" {...props}>
        {children}
      </li>
    );
  },
  ul: ({ node, children, ...props }) => {
    return (
      <ul className="list-decimal list-outside ml-4 max-w-full overflow-hidden" {...props}>
        {children}
      </ul>
    );
  },
  strong: ({ node, children, ...props }) => {
    return (
      <span className="font-semibold" {...props}>
        {children}
      </span>
    );
  },
  a: ({ node, children, ...props }) => {
    return (
      // @ts-expect-error
      <Link
        className="text-blue-500 hover:underline break-all max-w-full inline-block overflow-hidden"
        target="_blank"
        rel="noreferrer"
        {...props}
      >
        {children}
      </Link>
    );
  },
  h1: ({ node, children, ...props }) => {
    return (
      <h1 className="text-3xl font-semibold mt-6 mb-2 overflow-wrap-anywhere max-w-full overflow-hidden" {...props}>
        {children}
      </h1>
    );
  },
  h2: ({ node, children, ...props }) => {
    return (
      <h2 className="text-2xl font-semibold mt-6 mb-2 overflow-wrap-anywhere max-w-full overflow-hidden" {...props}>
        {children}
      </h2>
    );
  },
  h3: ({ node, children, ...props }) => {
    return (
      <h3 className="text-xl font-semibold mt-6 mb-2 overflow-wrap-anywhere max-w-full overflow-hidden" {...props}>
        {children}
      </h3>
    );
  },
  h4: ({ node, children, ...props }) => {
    return (
      <h4 className="text-lg font-semibold mt-6 mb-2 overflow-wrap-anywhere max-w-full overflow-hidden" {...props}>
        {children}
      </h4>
    );
  },
  h5: ({ node, children, ...props }) => {
    return (
      <h5 className="text-base font-semibold mt-6 mb-2 overflow-wrap-anywhere max-w-full overflow-hidden" {...props}>
        {children}
      </h5>
    );
  },
  h6: ({ node, children, ...props }) => {
    return (
      <h6 className="text-sm font-semibold mt-6 mb-2 overflow-wrap-anywhere max-w-full overflow-hidden" {...props}>
        {children}
      </h6>
    );
  },
};

const remarkPlugins = [remarkGfm];

const NonMemoizedMarkdown = ({ children }: { children: string }) => {
  return (
    <div className="max-w-full overflow-hidden">
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
