'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaGamepad, FaStore, FaCog } from 'react-icons/fa';

const Navigation: React.FC = () => {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    {
      name: 'My Games',
      path: '/',
      icon: <FaGamepad className="w-5 h-5 mr-2" />
    },
    {
      name: 'Game Store',
      path: '/store',
      icon: <FaStore className="w-5 h-5 mr-2" />
    },
    {
      name: 'Settings',
      path: '/settings',
      icon: <FaCog className="w-5 h-5 mr-2" />
    }
  ];

  return (
    <>
      {/* Mobile Navigation */}
      <div className="md:hidden bg-gray-900 p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-white">DOS USB</h1>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-white focus:outline-none"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-gray-800 p-4">
          <ul>
            {navItems.map((item) => (
              <li key={item.path} className="mb-2">
                <Link
                  href={item.path}
                  className={`flex items-center p-2 rounded-md ${
                    pathname === item.path
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-700 text-gray-300'
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  {item.icon}
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Desktop Navigation */}
      <div className="hidden md:flex flex-col w-64 bg-gray-900 h-screen">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-2xl font-bold text-white">DOS USB</h1>
          <p className="text-gray-400 text-sm">DOS Games Collection</p>
        </div>
        <div className="flex-grow p-4">
          <ul>
            {navItems.map((item) => (
              <li key={item.path} className="mb-2">
                <Link
                  href={item.path}
                  className={`flex items-center p-3 rounded-md ${
                    pathname === item.path
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  {item.icon}
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-4 text-center text-xs text-gray-500">
          <p>DOS USB v0.1.0</p>
          <p>Running from portable drive</p>
        </div>
      </div>
    </>
  );
};

export default Navigation;
