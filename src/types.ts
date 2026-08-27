/**
 * TVm Frontend Types & Interfaces
 */

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

export enum AndroidKeyCode {
  KEYCODE_UNKNOWN = 0,
  KEYCODE_HOME = 3,
  KEYCODE_BACK = 4,
  KEYCODE_DPAD_UP = 19,
  KEYCODE_DPAD_DOWN = 20,
  KEYCODE_DPAD_LEFT = 21,
  KEYCODE_DPAD_RIGHT = 22,
  KEYCODE_DPAD_CENTER = 23,
  KEYCODE_VOLUME_UP = 24,
  KEYCODE_VOLUME_DOWN = 25,
  KEYCODE_POWER = 26,
  KEYCODE_SEARCH = 84,
  KEYCODE_DEL = 67,
  KEYCODE_CLEAR = 28,
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
  KEYCODE_BUTTON_X = 99,
  KEYCODE_BUTTON_Y = 100,
  KEYCODE_BUTTON_L1 = 102,
  KEYCODE_BUTTON_R1 = 103,
  KEYCODE_BUTTON_L2 = 104,
  KEYCODE_BUTTON_R2 = 105,
  KEYCODE_BUTTON_START = 108,
  KEYCODE_BUTTON_SELECT = 109,
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

export type ActiveUIMode =
  | 'remote'
  | 'keyboard'
  | 'voice'
  | 'touchpad'
  | 'airmouse'
  | 'gamepad'
  | 'apps'
  | 'diagnostics';

export interface TVAppItem {
  id: string;
  name: string;
  packageName: string;
  deepLink: string;
  iconBg: string;
  category: string;
  isPopular?: boolean;
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

export interface UserSettings {
  hapticsEnabled: boolean;
  keyRepeat: boolean;
  realism3D: 'ultra' | 'balanced' | 'flat';
  remoteTheme: 'titanium' | 'obsidian' | 'silver' | 'champagne';
  gyroSensitivity: number;
  gyroDeadZone: number;
  motionSmoothing: number;
  axisInversionX: boolean;
  axisInversionY: boolean;
  autoReconnect: boolean;
  preferredTvId: string | null;
}
