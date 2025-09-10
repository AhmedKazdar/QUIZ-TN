import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeSocket, onOnlineUsers } from '../services/sockets';

interface User {
  userId: string;
  username: string;
}

interface OnlineUser extends User {
  socketId?: string;
  lastSeen?: string;
}

const OnlineUsersScreen: React.FC = () => {
  const router = useRouter();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const setupSocket = async () => {
      try {
        const userJson = await AsyncStorage.getItem('user');
        if (!userJson) {
          throw new Error('No user found. Please log in first.');
        }
        
        const user = JSON.parse(userJson);
        const socket = await initializeSocket();
        if (!socket) {
          throw new Error('Failed to initialize socket connection');
        }

        // Listen for online users
        const unsubscribe = onOnlineUsers((users: OnlineUser[]) => {
          setOnlineUsers(users);
          setError(null);
        });

        // Handle connection errors
        const handleError = (err: Error) => {
          console.error('Socket error:', err);
          setError('Connection error. Please check your network and try again.');
        };

        // Store the error handlers for cleanup
        socket.on('connect_error', handleError);
        socket.on('error', handleError);

        // Return cleanup function
        return () => {
          // Call the cleanup function returned by onOnlineUsers
          unsubscribe?.();
          
          // Clean up error handlers
          if (socket) {
            socket.off('connect_error', handleError);
            socket.off('error', handleError);
            // Optionally disconnect socket on unmount
            // if (socket.connected) socket.disconnect();
          }
        };
      } catch (err) {
        console.error('Error setting up socket:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      }
    };

    setupSocket();
  }, []);

  const renderUser = ({ item }: { item: OnlineUser }) => (
    <View style={styles.userItem}>
      <Text style={styles.username}>{item.username}</Text>
      <Text style={styles.userId}>ID: {item.userId}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Online Users ({onlineUsers.length})</Text>
      
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={onlineUsers}
          keyExtractor={(item) => item.userId}
          renderItem={renderUser}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {error ? 'Error loading users' : 'No users online'}
            </Text>
          }
        />
      )}
    </View>
  );
};

export default OnlineUsersScreen;

const styles = StyleSheet.create({
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 15,
    borderRadius: 5,
    marginVertical: 10,
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  userItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  username: {
    fontSize: 18,
    fontWeight: '500',
  },
  userId: {
    fontSize: 14,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 20,
  },
});
