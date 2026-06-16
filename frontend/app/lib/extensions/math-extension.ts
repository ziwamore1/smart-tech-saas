'use client';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { MathRenderer } from '../../apps/app-portal/components/exams/math-renderer';

export interface MathOptions {
  inline: boolean;
  HTMLAttributes: Record<string, any>;
}

export const MathExtension = Node.create<MathOptions>({
  name: 'math',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    return {
      inline: true,
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      expression: { default: '' },
      display: { default: 'inline' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-math]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-math': '' }, HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(({ node }: any) => {
      const { expression, display } = node.attrs;
      return <MathRenderer expression={expression} display={display} />;
    });
  },

  addCommands() {
    return {
      setMath:
        (expression: string, display: 'inline' | 'block' = 'inline') =>
        ({ commands }: any) =>
          commands.insertContent({
            type: this.name,
            attrs: { expression, display },
          }),
    };
  },
});
