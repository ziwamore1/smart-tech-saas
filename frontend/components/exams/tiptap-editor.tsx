'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import { Table as TableExtension, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import LinkExtension from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  minHeight?: string;
}

export default function TiptapEditor({ content, onChange, placeholder = 'Type your question here...', editable = true, minHeight = '200px' }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      ImageExtension.configure({ inline: true }),
      TableExtension.configure({ resizable: true }),
      TableRow, TableCell, TableHeader,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      Highlight,
      Placeholder.configure({ placeholder }),
      LinkExtension.configure({ openOnClick: false }),
      TaskList, TaskItem.configure({ nested: true }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  const ToolbarBtn = ({ onClick, active, label, icon }: { onClick: () => void; active?: boolean; label: string; icon: string }) => (
    <button type="button" onClick={onClick} title={label}
      style={{
        padding: '6px 10px', border: '1px solid #e8ddd0', borderRadius: '6px',
        background: active ? '#ea6645' : 'white', color: active ? 'white' : '#374151',
        cursor: 'pointer', fontSize: '13px', fontWeight: 500, lineHeight: 1, transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#ea6645'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8ddd0'; }}
    ><i className={`fa ${icon}`} /></button>
  );

  const addImage = () => {
    const url = prompt('Image URL:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const addLink = () => {
    const url = prompt('Link URL:');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div style={{ border: '1px solid #e8ddd0', borderRadius: '10px', overflow: 'hidden', background: '#fefcf9' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '8px 12px', borderBottom: '1px solid #e8ddd0', background: '#f5efe8' }}>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} label="Bold" icon="fa-bold" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} label="Italic" icon="fa-italic" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} label="Underline" icon="fa-underline" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} label="Strikethrough" icon="fa-strikethrough" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} label="Highlight" icon="fa-highlighter" />
        <div style={{ width: '1px', background: '#e8ddd0', margin: '0 4px' }} />
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} label="Left" icon="fa-align-left" />
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} label="Center" icon="fa-align-center" />
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} label="Right" icon="fa-align-right" />
        <div style={{ width: '1px', background: '#e8ddd0', margin: '0 4px' }} />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} label="H1" icon="fa-heading" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} label="H2" icon="fa-heading" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} label="Bullet List" icon="fa-list-ul" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} label="Ordered List" icon="fa-list-ol" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} label="Task List" icon="fa-tasks" />
        <div style={{ width: '1px', background: '#e8ddd0', margin: '0 4px' }} />
        <ToolbarBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} active={false} label="Table" icon="fa-table" />
        <ToolbarBtn onClick={addImage} active={false} label="Image" icon="fa-image" />
        <ToolbarBtn onClick={addLink} active={editor.isActive('link')} label="Link" icon="fa-link" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} label="Quote" icon="fa-quote-right" />
        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} label="Divider" icon="fa-minus" />
      </div>
      <EditorContent editor={editor} style={{ padding: '16px', minHeight, outline: 'none' }} />
    </div>
  );
}
