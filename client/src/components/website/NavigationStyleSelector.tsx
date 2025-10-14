'use client';

import { useState, useEffect } from 'react';

interface NavigationStyleSelectorProps {
  value: 'top';
  onChange: (value: 'top') => void;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
}

interface NavigationStyle {
  id: 'top';
  name: string;
  description: string;
  preview: React.ReactNode;
  features: string[];
}

export default function NavigationStyleSelector({ value, onChange, colors }: NavigationStyleSelectorProps) {
  const [selectedStyle, setSelectedStyle] = useState<'top'>(value);

  // Sync with parent value changes
  useEffect(() => {
    setSelectedStyle(value);
  }, [value]);

  const handleStyleChange = (styleId: 'top') => {
    setSelectedStyle(styleId);
    onChange(styleId);
  };

  const navigationStyles: NavigationStyle[] = [
    {
      id: 'top',
      name: 'Top Navigation',
      description: 'Classic horizontal navigation bar at the top of the page',
      features: ['Clean & modern', 'Mobile responsive', 'Easy to navigate', 'Standard layout'],
      preview: (
        <div className="w-full h-24 bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
          <div 
            className="w-full h-8 flex items-center px-4 justify-between border-b-2"
            style={{ backgroundColor: colors.primary, borderBottomColor: colors.secondary }}
          >
            <div className="text-white text-xs font-bold">J&J</div>
            <div className="flex space-x-2">
              {['HOME', 'STORY', 'RSVP'].map((item, index) => (
                <div key={index} className="text-white text-xs font-medium opacity-90">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="p-3">
            <div className="w-full h-2 bg-gray-300 rounded mb-2"></div>
            <div className="w-3/4 h-2 bg-gray-200 rounded mb-2"></div>
            <div className="w-1/2 h-2 bg-gray-200 rounded"></div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Navigation Style</h3>
        <p className="text-sm text-gray-600 mb-4">
          Choose how your website navigation will be displayed to your guests
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {navigationStyles.map((style) => (
          <div key={style.id} className="space-y-4">
            <div 
              className={`cursor-pointer rounded-lg border-2 transition-all duration-200 ${
                selectedStyle === style.id 
                  ? 'border-purple-500 ring-2 ring-purple-200' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleStyleChange(style.id)}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">{style.name}</h4>
                  <input
                    type="radio"
                    name="navigation-style"
                    value={style.id}
                    checked={selectedStyle === style.id}
                    onChange={() => handleStyleChange(style.id)}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                  />
                </div>
                {style.preview}
                <p className="text-sm text-gray-600 mt-3 mb-3">
                  {style.description}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="text-sm font-medium text-gray-700">Features:</h5>
              <ul className="text-xs text-gray-600 space-y-1">
                {style.features.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <svg className="w-3 h-3 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-blue-800">Navigation Preview</h4>
            <p className="text-sm text-blue-700 mt-1">
              The selected navigation style will adapt to your chosen colors and branding. 
              You can preview the full website design after saving your changes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}