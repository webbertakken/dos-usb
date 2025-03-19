'use client';

import React, { useState } from 'react';
import { FaSave, FaFolder, FaInfoCircle } from 'react-icons/fa';

export default function SettingsPage() {
  const [dosboxPath, setDosboxPath] = useState('');
  const [gamesPath, setGamesPath] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, we would save these settings to electron-store or similar
    console.log('Saving settings:', { dosboxPath, gamesPath });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="p-6 h-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">Configure your DOS USB environment</p>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl">
        <form onSubmit={handleSave}>
          <div className="mb-6">
            <label htmlFor="dosboxPath" className="block text-sm font-medium text-gray-300 mb-1">
              DOSBox Path
            </label>
            <div className="flex">
              <input
                type="text"
                id="dosboxPath"
                value={dosboxPath}
                onChange={(e) => setDosboxPath(e.target.value)}
                placeholder="C:\Path\To\DOSBox\dosbox.exe"
                className="flex-grow p-2.5 bg-gray-700 border border-gray-600 text-white rounded-l-lg focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                className="px-4 py-2.5 bg-gray-600 text-white rounded-r-lg hover:bg-gray-700"
                onClick={() => {
                  // In a real app, we would use electron's dialog to browse for the file
                  console.log('Browse for DOSBox path');
                }}
              >
                <FaFolder />
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-400">
              <FaInfoCircle className="inline mr-1" />
              Path to the DOSBox executable. Leave empty to use the bundled version.
            </p>
          </div>

          <div className="mb-6">
            <label htmlFor="gamesPath" className="block text-sm font-medium text-gray-300 mb-1">
              Games Directory
            </label>
            <div className="flex">
              <input
                type="text"
                id="gamesPath"
                value={gamesPath}
                onChange={(e) => setGamesPath(e.target.value)}
                placeholder="C:\Path\To\Games"
                className="flex-grow p-2.5 bg-gray-700 border border-gray-600 text-white rounded-l-lg focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                className="px-4 py-2.5 bg-gray-600 text-white rounded-r-lg hover:bg-gray-700"
                onClick={() => {
                  // In a real app, we would use electron's dialog to browse for the directory
                  console.log('Browse for games directory');
                }}
              >
                <FaFolder />
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-400">
              <FaInfoCircle className="inline mr-1" />
              Directory where downloaded games will be stored. Leave empty to use the default location.
            </p>
          </div>

          {saveSuccess && (
            <div className="mb-4 p-3 bg-green-700/50 text-green-200 rounded-md">
              Settings saved successfully!
            </div>
          )}

          <button
            type="submit"
            className="flex items-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            <FaSave className="mr-2" />
            Save Settings
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-700">
          <h2 className="text-xl font-bold text-white mb-3">About</h2>
          <div className="text-gray-300 space-y-2">
            <p>DOS USB v0.1.0</p>
            <p>A modern UI for playing DOS games from a USB drive.</p>
            <p className="text-xs text-gray-500 mt-2">
              Note: This application does not include any games. Games must be downloaded separately and are subject to their own licensing terms.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
