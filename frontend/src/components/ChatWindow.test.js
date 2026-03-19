import React from 'react';
import { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import ChatWindow from './ChatWindow';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    delete: jest.fn(),
    post: jest.fn(),
  },
}));

const createSocketMock = () => ({
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
});

const currentUser = { id: 'u1', username: 'Alice' };
const selectedChat = { id: 'u2', username: 'Bob' };

const baseMessage = {
  _id: 'm1',
  sender: 'u1',
  receiver: 'u2',
  content: 'Hello there',
  status: 'sent',
  timestamp: new Date().toISOString(),
};

describe('ChatWindow Undo UX', () => {
  beforeAll(() => {
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: jest.fn(),
    });
  });

  beforeEach(() => {
    jest.useFakeTimers();
    axios.get.mockResolvedValue({ data: [baseMessage] });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const renderWindow = (socketOverride = createSocketMock()) => render(
    <ChatWindow
      socket={socketOverride}
      selectedChat={selectedChat}
      currentUser={currentUser}
      activeTypingUser={null}
      onIncomingMessage={jest.fn()}
      onPresenceUpdate={jest.fn()}
      onConversationActivity={jest.fn()}
    />,
  );

  const deleteMessageAndWaitForUndo = async () => {
    await screen.findByText('Hello there');
    fireEvent.click(screen.getByTitle('Message options'));
    fireEvent.click(await screen.findByText('Delete'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    });
  };

  it('shows undo banner after delete and auto-hides when window expires', async () => {
    axios.delete.mockResolvedValue({
      data: {
        success: true,
        messageId: 'm1',
        undoExpiresAt: new Date(Date.now() + 5000).toISOString(),
      },
    });

    renderWindow();

    await screen.findByText('Hello there');

    fireEvent.click(screen.getByTitle('Message options'));
    fireEvent.click(await screen.findByText('Delete'));

    await waitFor(() => {
      expect(screen.getByText(/Message deleted \(\d+s\)/)).toBeInTheDocument();
    });

    act(() => {
      jest.advanceTimersByTime(5500);
    });

    expect(screen.queryByText(/Message deleted \(\d+s\)/)).not.toBeInTheDocument();
  });

  it('shows restore-expired toast when undo restore returns 410', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    axios.delete.mockResolvedValue({
      data: {
        success: true,
        messageId: 'm1',
        undoExpiresAt: new Date(Date.now() + 5000).toISOString(),
      },
    });

    axios.post.mockRejectedValue({
      response: {
        status: 410,
      },
    });

    renderWindow();

    await deleteMessageAndWaitForUndo();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => {
      expect(screen.getByText('Undo expired. Message can no longer be restored.')).toBeInTheDocument();
    });

    act(() => {
      jest.advanceTimersByTime(3600);
    });

    await waitFor(() => {
      expect(screen.queryByText('Undo expired. Message can no longer be restored.')).not.toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });

  it('shows not-eligible toast when undo restore returns 409', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    axios.delete.mockResolvedValue({
      data: {
        success: true,
        messageId: 'm1',
        undoExpiresAt: new Date(Date.now() + 5000).toISOString(),
      },
    });

    axios.post.mockRejectedValue({
      response: {
        status: 409,
      },
    });

    renderWindow();

    await deleteMessageAndWaitForUndo();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => {
      expect(screen.getByText('This message is not available for restore.')).toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });

  it('shows generic restore error when undo restore returns unexpected status', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    axios.delete.mockResolvedValue({
      data: {
        success: true,
        messageId: 'm1',
        undoExpiresAt: new Date(Date.now() + 5000).toISOString(),
      },
    });

    axios.post.mockRejectedValue({
      response: {
        status: 500,
      },
    });

    renderWindow();

    await deleteMessageAndWaitForUndo();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => {
      expect(screen.getByText('Could not restore message. Please try again.')).toBeInTheDocument();
    });

    act(() => {
      jest.advanceTimersByTime(3600);
    });

    await waitFor(() => {
      expect(screen.queryByText('Could not restore message. Please try again.')).not.toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });

  it('shows undo banner when messageDeleted socket payload has undo window', async () => {
    const socket = createSocketMock();
    renderWindow(socket);

    await screen.findByText('Hello there');

    const onCalls = socket.on.mock.calls;
    const deletedHandlerCall = onCalls.find(([eventName]) => eventName === 'messageDeleted');
    expect(deletedHandlerCall).toBeTruthy();

    const deletedHandler = deletedHandlerCall[1];

    act(() => {
      deletedHandler({
        messageId: 'm1',
        senderId: 'u1',
        deletedAt: new Date().toISOString(),
        undoExpiresAt: new Date(Date.now() + 5000).toISOString(),
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Message deleted \(\d+s\)/)).toBeInTheDocument();
    });
  });

  it('clears undo banner when messageRestored socket event is received', async () => {
    const socket = createSocketMock();
    renderWindow(socket);

    await screen.findByText('Hello there');

    const onCalls = socket.on.mock.calls;
    const deletedHandlerCall = onCalls.find(([eventName]) => eventName === 'messageDeleted');
    const restoredHandlerCall = onCalls.find(([eventName]) => eventName === 'messageRestored');

    expect(deletedHandlerCall).toBeTruthy();
    expect(restoredHandlerCall).toBeTruthy();

    const deletedHandler = deletedHandlerCall[1];
    const restoredHandler = restoredHandlerCall[1];

    act(() => {
      deletedHandler({
        messageId: 'm1',
        senderId: 'u1',
        deletedAt: new Date().toISOString(),
        undoExpiresAt: new Date(Date.now() + 5000).toISOString(),
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Message deleted \(\d+s\)/)).toBeInTheDocument();
    });

    act(() => {
      restoredHandler({
        messageId: 'm1',
        senderId: 'u1',
      });
    });

    await waitFor(() => {
      expect(screen.queryByText(/Message deleted \(\d+s\)/)).not.toBeInTheDocument();
    });
  });

  it('does not show undo banner when messageDeleted is from another sender', async () => {
    const socket = createSocketMock();
    renderWindow(socket);

    await screen.findByText('Hello there');

    const onCalls = socket.on.mock.calls;
    const deletedHandlerCall = onCalls.find(([eventName]) => eventName === 'messageDeleted');

    expect(deletedHandlerCall).toBeTruthy();

    const deletedHandler = deletedHandlerCall[1];

    act(() => {
      deletedHandler({
        messageId: 'm1',
        senderId: 'u2',
        deletedAt: new Date().toISOString(),
        undoExpiresAt: new Date(Date.now() + 5000).toISOString(),
      });
    });

    expect(screen.queryByText(/Message deleted \(\d+s\)/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });

  it('disables undo at 0 seconds and does not call restore', async () => {
    axios.delete.mockResolvedValue({
      data: {
        success: true,
        messageId: 'm1',
        undoExpiresAt: new Date(Date.now() + 1000).toISOString(),
      },
    });

    renderWindow();

    await deleteMessageAndWaitForUndo();

    const undoButton = screen.getByRole('button', { name: 'Undo' });
    expect(undoButton).toBeEnabled();

    act(() => {
      jest.advanceTimersByTime(1100);
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    });

    expect(axios.post).not.toHaveBeenCalled();
  });
});
