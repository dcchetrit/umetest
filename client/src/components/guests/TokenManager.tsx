'use client';

import { useState } from 'react';
import { FirestoreService, Guest } from '@ume/shared';

interface TokenManagerProps {
  coupleId: string;
  coupleSlug: string;
  guests: Guest[];
  onTokensGenerated: () => void;
}

export default function TokenManager({ coupleId, coupleSlug, guests, onTokensGenerated }: TokenManagerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showLinks, setShowLinks] = useState(false);

  const generateAllTokens = async () => {
    setIsGenerating(true);
    try {
      await FirestoreService.generateTokensForAllGuests(coupleId);
      onTokensGenerated();
      alert('Invitation tokens generated successfully!');
    } catch (error) {
      console.error('Error generating tokens:', error);
      alert('Failed to generate tokens');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateInviteLink = (token: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/invite/en/${coupleSlug}/${token}`;
  };

  const copyAllLinks = async () => {
    const guestsWithTokens = guests.filter(guest => guest.inviteToken);
    const links = guestsWithTokens.map(guest => 
      `${guest.firstName}: ${generateInviteLink(guest.inviteToken!)}`
    ).join('\n');

    try {
      await navigator.clipboard.writeText(links);
      alert('All invite links copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy links:', error);
      alert('Failed to copy links');
    }
  };

  const guestsWithTokens = guests.filter(guest => guest.inviteToken);
  const guestsWithoutTokens = guests.filter(guest => !guest.inviteToken);

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Invitation Link Manager</h2>
      
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{guests.length}</div>
          <div className="text-sm text-gray-600">Total Guests</div>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{guestsWithTokens.length}</div>
          <div className="text-sm text-gray-600">With Invite Links</div>
        </div>
        <div className="text-center p-4 bg-yellow-50 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">{guestsWithoutTokens.length}</div>
          <div className="text-sm text-gray-600">Missing Links</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={generateAllTokens}
          disabled={isGenerating}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : 'Generate Missing Tokens'}
        </button>
        
        {guestsWithTokens.length > 0 && (
          <>
            <button
              onClick={() => setShowLinks(!showLinks)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              {showLinks ? 'Hide' : 'Show'} All Links
            </button>
            
            <button
              onClick={copyAllLinks}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              Copy All Links
            </button>
          </>
        )}
      </div>

      {showLinks && guestsWithTokens.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-gray-900">Individual Invite Links:</h3>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {guestsWithTokens.map((guest) => (
              <div key={guest.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{guest.firstName}</div>
                    <div className="text-sm text-blue-600 font-mono break-all">
                      {generateInviteLink(guest.inviteToken!)}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generateInviteLink(guest.inviteToken!));
                      alert(`Link copied for ${guest.firstName}!`);
                    }}
                    className="text-xs text-gray-600 hover:text-gray-800 ml-2"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {guestsWithoutTokens.length > 0 && (
        <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
          <h4 className="font-medium text-yellow-800 mb-2">
            Guests without invite links ({guestsWithoutTokens.length}):
          </h4>
          <div className="text-sm text-yellow-700">
            {guestsWithoutTokens.map(guest => guest.firstName).join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}