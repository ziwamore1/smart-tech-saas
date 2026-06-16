'use client';
import { useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import LinkExtension from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { MathExtension } from '../../lib/extensions/math-extension';

interface LessonPlanRichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  minHeight?: string;
}

export default function LessonPlanRichTextEditor({
  content, onChange, placeholder = 'Type here...', editable = true, minHeight = '300px',
}: LessonPlanRichTextEditorProps) {
  const [showMathInput, setShowMathInput] = useState(false);
  const [mathExpr, setMathExpr] = useState('');
  const [mathDisplay, setMathDisplay] = useState<'inline' | 'block'>('inline');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      ImageExtension.configure({ inline: true }),
      Table.configure({ resizable: true }),
      TableRow, TableCell, TableHeader,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline, Highlight,
      Placeholder.configure({ placeholder }),
      LinkExtension.configure({ openOnClick: false }),
      TaskList, TaskItem.configure({ nested: true }),
      MathExtension,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  const insertMath = useCallback(() => {
    if (!editor || !mathExpr.trim()) return;
    editor.chain().focus().setMath(mathExpr.trim(), mathDisplay).run();
    setMathExpr('');
    setShowMathInput(false);
  }, [editor, mathExpr, mathDisplay]);

  const insertLink = useCallback(() => {
    if (!editor || !linkUrl.trim()) return;
    editor.chain().focus().setLink({ href: linkUrl.trim() }).run();
    setLinkUrl('');
    setShowLinkInput(false);
  }, [editor, linkUrl]);

  const insertImage = useCallback(() => {
    if (!editor || !imageUrl.trim()) return;
    editor.chain().focus().setImage({ src: imageUrl.trim() }).run();
    setImageUrl('');
    setShowImageInput(false);
  }, [editor, imageUrl]);

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

  return (
    <div style={{ border: '1px solid #e8ddd0', borderRadius: '10px', overflow: 'hidden', background: '#fefcf9' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '8px 12px', borderBottom: '1px solid #e8ddd0', background: '#f5efe8' }}>
        {/* Text formatting */}
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} label="Bold" icon="fa-bold" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} label="Italic" icon="fa-italic" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} label="Underline" icon="fa-underline" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} label="Strikethrough" icon="fa-strikethrough" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} label="Highlight" icon="fa-highlighter" />
        <div style={{ width: '1px', background: '#e8ddd0', margin: '0 4px' }} />
        {/* Alignment */}
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} label="Left" icon="fa-align-left" />
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} label="Center" icon="fa-align-center" />
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} label="Right" icon="fa-align-right" />
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} label="Justify" icon="fa-align-justify" />
        <div style={{ width: '1px', background: '#e8ddd0', margin: '0 4px' }} />
        {/* Headings & Lists */}
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} label="H1" icon="fa-heading" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} label="H2" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} label="H3" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} label="Bullet List" icon="fa-list-ul" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} label="Ordered List" icon="fa-list-ol" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} label="Task List" icon="fa-tasks" />
        <div style={{ width: '1px', background: '#e8ddd0', margin: '0 4px' }} />
        {/* Table */}
        <ToolbarBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} label="Insert Table" icon="fa-table" />
        {editor.isActive('table') && (
          <>
            <ToolbarBtn onClick={() => editor.chain().focus().addColumnBefore().run()} label="Add Column Before" icon="fa-columns" />
            <ToolbarBtn onClick={() => editor.chain().focus().addColumnAfter().run()} label="Add Column After" />
            <ToolbarBtn onClick={() => editor.chain().focus().deleteColumn().run()} label="Delete Column" icon="fa-trash-o" />
            <ToolbarBtn onClick={() => editor.chain().focus().addRowBefore().run()} label="Add Row Before" icon="fa-rows" />
            <ToolbarBtn onClick={() => editor.chain().focus().addRowAfter().run()} label="Add Row After" />
            <ToolbarBtn onClick={() => editor.chain().focus().deleteRow().run()} label="Delete Row" />
            <ToolbarBtn onClick={() => editor.chain().focus().mergeCells().run()} label="Merge Cells" icon="fa-compress" />
            <ToolbarBtn onClick={() => editor.chain().focus().splitCell().run()} label="Split Cell" icon="fa-expand" />
            <ToolbarBtn onClick={() => editor.chain().focus().toggleHeaderColumn().run()} label="Toggle Header Col" />
            <ToolbarBtn onClick={() => editor.chain().focus().toggleHeaderRow().run()} label="Toggle Header Row" />
            <ToolbarBtn onClick={() => editor.chain().focus().deleteTable().run()} label="Delete Table" icon="fa-trash" />
          </>
        )}
        <div style={{ width: '1px', background: '#e8ddd0', margin: '0 4px' }} />
        {/* Math */}
        <ToolbarBtn onClick={() => setShowMathInput(true)} label="Insert Math Equation" icon="fa-superscript" />
        {/* Image & Link */}
        <ToolbarBtn onClick={() => setShowImageInput(true)} label="Insert Image" icon="fa-image" />
        <ToolbarBtn onClick={() => setShowLinkInput(true)} active={editor.isActive('link')} label="Insert Link" icon="fa-link" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} label="Blockquote" icon="fa-quote-right" />
        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} label="Divider" icon="fa-minus" />
        <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} label="Undo" icon="fa-undo" />
        <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} label="Redo" icon="fa-repeat" />
      </div>

      <EditorContent editor={editor} style={{ padding: '16px', minHeight, outline: 'none' }} />

      {/* Math Input Modal */}
      {showMathInput && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowMathInput(false)}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '480px', maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#1F2937' }}>Insert Math Equation</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>LaTeX Expression</label>
              <input
                type="text" value={mathExpr} onChange={e => setMathExpr(e.target.value)}
                placeholder="e.g. x^2 + y^2 = z^2 or \frac{1}{2}"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px', fontFamily: 'monospace' }}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') insertMath(); }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Display Mode</label>
              <select value={mathDisplay} onChange={e => setMathDisplay(e.target.value as any)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px' }}>
                <option value="inline">Inline ($...$)</option>
                <option value="block">Block ($$...$$)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowMathInput(false)} style={{ padding: '10px 20px', border: '1px solid #e8ddd0', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={insertMath} style={{ padding: '10px 20px', background: '#ea6645', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }} disabled={!mathExpr.trim()}>Insert</button>
            </div>
          </div>
        </div>
      )}

      {/* Link Input Modal */}
      {showLinkInput && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowLinkInput(false)}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '420px', maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#1F2937' }}>Insert Link</h3>
            <input type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://..."
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' }}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') insertLink(); }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowLinkInput(false)} style={{ padding: '10px 20px', border: '1px solid #e8ddd0', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={insertLink} style={{ padding: '10px 20px', background: '#ea6645', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }} disabled={!linkUrl.trim()}>Insert</button>
            </div>
          </div>
        </div>
      )}

      {/* Image Input Modal */}
      {showImageInput && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowImageInput(false)}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '480px', maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#1F2937' }}>Insert Image</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Image URL</label>
              <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px', marginBottom: '4px' }}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') insertImage(); }}
              />
              <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '4px 0 0' }}>You can upload images to Cloudinary from the Media section and paste the URL here.</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowImageInput(false)} style={{ padding: '10px 20px', border: '1px solid #e8ddd0', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={insertImage} style={{ padding: '10px 20px', background: '#ea6645', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }} disabled={!imageUrl.trim()}>Insert</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
