import React, { useState } from 'react';
import { 
  Users, 
  MessageSquare, 
  LogOut, 
  Settings, 
  Plus,
  Search,
  Bell
} from 'lucide-react';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';

const Sidebar = () => {
  const [activeTab, setActiveTab] = useState('rooms');
  const [searchQuery, setSearchQuery] = useState('');
  const {
    currentRoom,
    rooms,
    onlineUsers,
    unreadCounts,
    joinRoom,
    isConnected
  } = useChat();
  const { user, logout } = useAuth();

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = onlineUsers.filter(username =>
    username.toLowerCase().includes(searchQuery.toLowerCase()) &&
    username !== user?.username
  );

  const handleRoomClick = (roomName) => {
    joinRoom(roomName);
  };

  const handleUserClick = (username) => {
    // For future implementation: start private chat
    console.log('Start private chat with:', username);
  };

  return (
    <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <h2 className="text-xl font-bold text-white">ChatApp</h2>
          </div>
          <div className="flex space-x-2">
            <button className="p-2 text-gray-400 hover:text-white transition-colors">
              <Bell className="h-5 w-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white transition-colors">
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* User Info */}
        <div className="flex items-center space-x-3 p-3 bg-gray-700/50 rounded-lg">
          <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-sm">
              {user?.username?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate">{user?.username}</p>
            <p className="text-gray-400 text-sm truncate">{user?.status || 'online'}</p>
          </div>
          <button
            onClick={logout}
            className="p-2 text-gray-400 hover:text-red-400 transition-colors"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('rooms')}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${
            activeTab === 'rooms'
              ? 'text-primary-400 border-b-2 border-primary-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>Rooms</span>
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${
            activeTab === 'users'
              ? 'text-primary-400 border-b-2 border-primary-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Users</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'rooms' ? (
          <div className="space-y-2 p-4">
            {filteredRooms.length > 0 ? (
              filteredRooms.map((room) => (
                <button
                  key={room.name}
                  onClick={() => handleRoomClick(room.name)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    currentRoom === room.name
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{room.name}</p>
                      <p className="text-sm text-gray-400 truncate">{room.description}</p>
                    </div>
                    {unreadCounts[room.name] > 0 && (
                      <span className="ml-2 px-2 py-1 bg-red-600 text-white text-xs rounded-full">
                        {unreadCounts[room.name]}
                      </span>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p>No rooms found</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((username) => (
                <button
                  key={username}
                  onClick={() => handleUserClick(username)}
                  className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="font-medium truncate">{username}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p>No users online</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        <button className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">
          <Plus className="h-4 w-4" />
          <span>New Room</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;