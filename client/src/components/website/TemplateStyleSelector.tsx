'use client';

import { useState, useEffect } from 'react';

interface TemplateStyleSelectorProps {
  value: 'classic' | 'modern' | 'elegant' | 'minimal';
  onChange: (value: 'classic' | 'modern' | 'elegant' | 'minimal') => void;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
}

interface TemplateStyle {
  id: 'classic' | 'modern' | 'elegant' | 'minimal';
  name: string;
  description: string;
  preview: React.ReactNode;
  features: string[];
  bestFor: string[];
}

export default function TemplateStyleSelector({ value, onChange, colors }: TemplateStyleSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<'classic' | 'modern' | 'elegant' | 'minimal'>(value);

  // Sync with parent value changes
  useEffect(() => {
    setSelectedTemplate(value);
  }, [value]);

  const handleTemplateChange = (templateId: 'classic' | 'modern' | 'elegant' | 'minimal') => {
    setSelectedTemplate(templateId);
    onChange(templateId);
  };

  const templateStyles: TemplateStyle[] = [
    {
      id: 'classic',
      name: 'Classic',
      description: 'Timeless design with traditional wedding aesthetics',
      features: ['Serif typography', 'Traditional layouts', 'Ornamental details', 'Formal appearance'],
      bestFor: ['Traditional weddings', 'Church ceremonies', 'Formal events', 'Classic couples'],
      preview: (
        <div className="w-full h-32 bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
          <div 
            className="w-full h-6 flex items-center justify-center text-xs font-serif border-b-2"
            style={{ backgroundColor: colors.primary, color: 'white', borderBottomColor: colors.secondary }}
          >
            ♥ John & Jane ♥
          </div>
          <div className="p-3 space-y-2">
            <div className="text-center">
              <div 
                className="w-12 h-12 mx-auto rounded-full border-4 mb-2 flex items-center justify-center text-xs font-serif"
                style={{ borderColor: colors.secondary, color: colors.primary }}
              >
                J&J
              </div>
              <div className="text-xs font-serif italic" style={{ color: colors.text }}>
                "Our Wedding Day"
              </div>
            </div>
            <div className="flex justify-center space-x-2">
              <div 
                className="w-8 h-1 rounded-full"
                style={{ backgroundColor: colors.accent }}
              ></div>
              <div 
                className="w-3 h-3 rounded-full border-2"
                style={{ borderColor: colors.secondary, backgroundColor: 'white' }}
              ></div>
              <div 
                className="w-8 h-1 rounded-full"
                style={{ backgroundColor: colors.accent }}
              ></div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'modern',
      name: 'Modern',
      description: 'Contemporary design with clean lines and bold elements',
      features: ['Sans-serif typography', 'Grid layouts', 'Bold imagery', 'Geometric shapes'],
      bestFor: ['Modern couples', 'Urban venues', 'Contemporary style', 'Tech-savvy couples'],
      preview: (
        <div className="w-full h-32 bg-gray-900 rounded-lg border-2 border-gray-200 overflow-hidden">
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div 
                className="w-4 h-4 rounded-none"
                style={{ backgroundColor: colors.primary }}
              ></div>
              <div className="text-xs font-bold tracking-widest text-white">
                J & J
              </div>
              <div 
                className="w-4 h-4 rounded-none"
                style={{ backgroundColor: colors.accent }}
              ></div>
            </div>
            <div 
              className="w-full h-10 rounded-none flex items-center justify-center text-xs font-black text-black tracking-wider"
              style={{ backgroundColor: colors.primary }}
            >
              SAVE THE DATE
            </div>
            <div className="grid grid-cols-4 gap-1">
              <div 
                className="h-3 rounded-none"
                style={{ backgroundColor: colors.secondary }}
              ></div>
              <div 
                className="h-3 rounded-none"
                style={{ backgroundColor: colors.accent }}
              ></div>
              <div 
                className="h-3 rounded-none"
                style={{ backgroundColor: colors.primary }}
              ></div>
              <div 
                className="h-3 rounded-none bg-white"
              ></div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'elegant',
      name: 'Elegant',
      description: 'Sophisticated design with luxury and refinement',
      features: ['Script typography', 'Flowing layouts', 'Subtle animations', 'Luxurious feel'],
      bestFor: ['Luxury weddings', 'Elegant venues', 'Sophisticated couples', 'Formal celebrations'],
      preview: (
        <div className="w-full h-32 bg-gradient-to-b from-pink-50 to-white rounded-lg border-2 border-gray-200 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-100/30 to-pink-100/30"></div>
          <div className="relative p-3 space-y-2">
            <div className="text-center">
              <div 
                className="text-xs italic font-light mb-2 script-font"
                style={{ color: colors.primary }}
              >
                Together Forever
              </div>
              <div 
                className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-xs text-white relative border-4 border-white shadow-md"
                style={{ backgroundColor: colors.secondary }}
              >
                <span className="font-script text-sm">J&J</span>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-center space-x-1">
                  <div 
                    className="w-8 h-px"
                    style={{ backgroundColor: colors.accent }}
                  ></div>
                  <div 
                    className="w-1 h-1 rounded-full"
                    style={{ backgroundColor: colors.accent }}
                  ></div>
                  <div 
                    className="w-3 h-3 rounded-full border-2"
                    style={{ borderColor: colors.accent, backgroundColor: 'white' }}
                  ></div>
                  <div 
                    className="w-1 h-1 rounded-full"
                    style={{ backgroundColor: colors.accent }}
                  ></div>
                  <div 
                    className="w-8 h-px"
                    style={{ backgroundColor: colors.accent }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'minimal',
      name: 'Minimal',
      description: 'Clean and simple design focusing on content',
      features: ['Clean typography', 'White space', 'Simple layouts', 'Content focus'],
      bestFor: ['Simple weddings', 'Intimate ceremonies', 'Modern minimalists', 'Clean aesthetic'],
      preview: (
        <div className="w-full h-32 bg-white rounded-lg border border-gray-100 overflow-hidden">
          <div className="p-4 space-y-4">
            <div className="text-center">
              <div 
                className="text-xs font-extralight tracking-[0.2em] mb-3"
                style={{ color: colors.text }}
              >
                JOHN & JANE
              </div>
              <div 
                className="w-12 h-px mx-auto"
                style={{ backgroundColor: colors.primary }}
              ></div>
            </div>
            <div className="space-y-3">
              <div 
                className="w-full h-1"
                style={{ backgroundColor: '#f5f5f5' }}
              ></div>
              <div 
                className="w-2/3 h-1 mx-auto"
                style={{ backgroundColor: '#f5f5f5' }}
              ></div>
            </div>
            <div className="flex justify-center">
              <div 
                className="px-4 py-1 border text-xs tracking-wider"
                style={{ borderColor: colors.primary, color: colors.primary }}
              >
                RSVP
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Template Style</h3>
        <p className="text-sm text-gray-600 mb-4">
          Choose the overall design aesthetic for your wedding website
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templateStyles.map((template) => (
          <div key={template.id} className="space-y-4">
            <div 
              className={`cursor-pointer rounded-lg border-2 transition-all duration-200 ${
                selectedTemplate === template.id 
                  ? 'border-purple-500 ring-2 ring-purple-200' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleTemplateChange(template.id)}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">{template.name}</h4>
                  <input
                    type="radio"
                    name="template-style"
                    value={template.id}
                    checked={selectedTemplate === template.id}
                    onChange={() => handleTemplateChange(template.id)}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                  />
                </div>
                {template.preview}
                <p className="text-sm text-gray-600 mt-3">
                  {template.description}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <h5 className="font-medium text-gray-700 mb-2">Features:</h5>
                <ul className="text-gray-600 space-y-1">
                  {template.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <svg className="w-3 h-3 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-gray-700 mb-2">Best for:</h5>
                <ul className="text-gray-600 space-y-1">
                  {template.bestFor.map((item, index) => (
                    <li key={index} className="flex items-center">
                      <svg className="w-3 h-3 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-purple-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-purple-800">Template Customization</h4>
            <p className="text-sm text-purple-700 mt-1">
              Each template adapts to your color scheme and branding. You can further customize 
              fonts, spacing, and specific elements after selecting your preferred style.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-yellow-800">Pro Tip</h4>
            <p className="text-sm text-yellow-700 mt-1">
              Consider your venue and wedding style when choosing a template. 
              You can always switch between templates and preview changes before publishing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}