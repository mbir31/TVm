/**
 * TVm Protocol & Data Types
 * Android TV Remote Service v2 specification constants and data models
 */

export const PAIRING_PORT = 6467;
export const REMOTE_PORT = 6466;

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  DISCOVERING = 'DISCOVERING',
  DISCOVERED = 'DISCOVERED',
  CONNECTING = 'CONNECTING',
  PAIRING = 'PAIRING',
  PAIRING_CODE_REQUIRED = 'PAIRING_CODE_REQUIRED',
  VERIFYING_PAIRING = 'VERIFYING_PAIRING',
  PAIRED = 'PAIRED',
  ESTABLISHING_REMOTE_SESSION = 'ESTABLISHING_REMOTE_SESSION',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  NETWORK_UNAVAILABLE = 'NETWORK_UNAVAILABLE',
  TV_UNAVAILABLE = 'TV_UNAVAILABLE',
  PAIRING_FAILED = 'PAIRING_FAILED',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  PROTOCOL_ERROR = 'PROTOCOL_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
}

export enum TVCapability {
  REMOTE_NAVIGATION = 'remoteNavigation',
  VOLUME = 'volume',
  MUTE = 'mute',
  POWER = 'power',
  MEDIA = 'media',
  KEYBOARD = 'keyboard',
  TEXT_INPUT = 'textInput',
  APP_LAUNCH = 'appLaunch',
  TOUCHPAD = 'touchpad',
  AIR_MOUSE = 'airMouse',
  MOTION = 'motion',
  GAME_CONTROLLER = 'gameController',
  VOICE = 'voice',
}

export type CapabilityStatus = 'SUPPORTED' | 'LIMITED' | 'UNSUPPORTED';

export type TVCapabilitiesMap = Record<TVCapability, CapabilityStatus>;

export interface TVDevice {
  id: string;
  name: string;
  manufacturer?: string;
  model?: string;
  platform?: 'Google TV' | 'Android TV' | 'Chromecast' | 'Generic Android TV';
  serviceType: string;
  host: string;
  discoveredPort: number;
  pairingPort: number;
  remotePort: number;
  capabilities: TVCapabilitiesMap;
  connectionState: ConnectionState;
  lastSeen: number;
  lastConnected?: number;
  isPaired: boolean;
  isFavorite?: boolean;
  isTestbed?: boolean;
}

export interface TVCredentialReference {
  tvId: string;
  credentialId: string;
  createdAt: number;
  updatedAt: number;
}

export interface TVCertificatePair {
  certPem: string;
  privateKeyPem: string;
  fingerprint: string;
}

export enum AndroidKeyCode {
  KEYCODE_UNKNOWN = 0,
  KEYCODE_SOFT_LEFT = 1,
  KEYCODE_SOFT_RIGHT = 2,
  KEYCODE_HOME = 3,
  KEYCODE_BACK = 4,
  KEYCODE_CALL = 5,
  KEYCODE_ENDCALL = 6,
  KEYCODE_0 = 7,
  KEYCODE_1 = 8,
  KEYCODE_2 = 9,
  KEYCODE_3 = 10,
  KEYCODE_4 = 11,
  KEYCODE_5 = 12,
  KEYCODE_6 = 13,
  KEYCODE_7 = 14,
  KEYCODE_8 = 15,
  KEYCODE_9 = 16,
  KEYCODE_STAR = 17,
  KEYCODE_POUND = 18,
  KEYCODE_DPAD_UP = 19,
  KEYCODE_DPAD_DOWN = 20,
  KEYCODE_DPAD_LEFT = 21,
  KEYCODE_DPAD_RIGHT = 22,
  KEYCODE_DPAD_CENTER = 23,
  KEYCODE_VOLUME_UP = 24,
  KEYCODE_VOLUME_DOWN = 25,
  KEYCODE_POWER = 26,
  KEYCODE_CAMERA = 27,
  KEYCODE_CLEAR = 28,
  KEYCODE_DEL = 67,
  KEYCODE_A = 29,
  KEYCODE_B = 30,
  KEYCODE_C = 31,
  KEYCODE_SEARCH = 84,
  KEYCODE_MEDIA_PLAY_PAUSE = 85,
  KEYCODE_MEDIA_STOP = 86,
  KEYCODE_MEDIA_NEXT = 87,
  KEYCODE_MEDIA_PREVIOUS = 88,
  KEYCODE_MEDIA_REWIND = 89,
  KEYCODE_MEDIA_FAST_FORWARD = 90,
  KEYCODE_MUTE = 91,
  KEYCODE_PAGE_UP = 92,
  KEYCODE_PAGE_DOWN = 93,
  KEYCODE_BUTTON_A = 96,
  KEYCODE_BUTTON_B = 97,
  KEYCODE_BUTTON_C = 98,
  KEYCODE_BUTTON_X = 99,
  KEYCODE_BUTTON_Y = 100,
  KEYCODE_BUTTON_Z = 101,
  KEYCODE_BUTTON_L1 = 102,
  KEYCODE_BUTTON_R1 = 103,
  KEYCODE_BUTTON_L2 = 104,
  KEYCODE_BUTTON_R2 = 105,
  KEYCODE_BUTTON_THUMBL = 106,
  KEYCODE_BUTTON_THUMBR = 107,
  KEYCODE_BUTTON_START = 108,
  KEYCODE_BUTTON_SELECT = 109,
  KEYCODE_BUTTON_MODE = 110,
  KEYCODE_ESCAPE = 111,
  KEYCODE_FORWARD_DEL = 112,
  KEYCODE_CTRL_LEFT = 113,
  KEYCODE_CTRL_RIGHT = 114,
  KEYCODE_CAPS_LOCK = 115,
  KEYCODE_SCROLL_LOCK = 116,
  KEYCODE_META_LEFT = 117,
  KEYCODE_META_RIGHT = 118,
  KEYCODE_FUNCTION = 119,
  KEYCODE_SYSRQ = 120,
  KEYCODE_BREAK = 121,
  KEYCODE_MOVE_HOME = 122,
  KEYCODE_MOVE_END = 123,
  KEYCODE_INSERT = 124,
  KEYCODE_FORWARD = 125,
  KEYCODE_MEDIA_PLAY = 126,
  KEYCODE_MEDIA_PAUSE = 127,
  KEYCODE_MEDIA_CLOSE = 128,
  KEYCODE_MEDIA_EJECT = 129,
  KEYCODE_MEDIA_RECORD = 130,
  KEYCODE_F1 = 131,
  KEYCODE_F2 = 132,
  KEYCODE_F3 = 133,
  KEYCODE_F4 = 134,
  KEYCODE_F5 = 135,
  KEYCODE_F6 = 136,
  KEYCODE_F7 = 137,
  KEYCODE_F8 = 138,
  KEYCODE_F9 = 139,
  KEYCODE_F10 = 140,
  KEYCODE_F11 = 141,
  KEYCODE_F12 = 142,
  KEYCODE_NUM_LOCK = 143,
  KEYCODE_NUMPAD_0 = 144,
  KEYCODE_VOLUME_MUTE = 164,
  KEYCODE_INFO = 165,
  KEYCODE_CHANNEL_UP = 166,
  KEYCODE_CHANNEL_DOWN = 167,
  KEYCODE_SETTINGS = 176,
  KEYCODE_TV_INPUT = 178,
  KEYCODE_GUIDE = 172,
  KEYCODE_CAPTIONS = 175,
  KEYCODE_PROG_RED = 183,
  KEYCODE_PROG_GREEN = 184,
  KEYCODE_PROG_YELLOW = 185,
  KEYCODE_PROG_BLUE = 186,
  KEYCODE_ASSIST = 219,
  KEYCODE_VOICE_ASSIST = 231,
  KEYCODE_ALL_APPS = 284,
}

export enum KeyDirection {
  START_LONG = 1,
  SHORT = 2,
  UP = 3,
}

export interface DiagnosticLog {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug' | 'trace';
  category: 'discovery' | 'pairing' | 'tls' | 'remote' | 'command' | 'testbed' | 'system';
  message: string;
  data?: Record<string, unknown>;
}

export interface TVCommandResult {
  success: boolean;
  timestamp: number;
  command: string;
  latencyMs?: number;
  error?: string;
}

export interface MotionInputPayload {
  x: number;
  y: number;
  z?: number;
  pitch?: number;
  roll?: number;
  yaw?: number;
  timestamp: number;
}
