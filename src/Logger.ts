import { getMemoryRef } from 'kernel/memory';

enum LogLevel {
  Alert = 1,
  Error = 2,
  Warn = 3,
  Info = 4,
  Debug = 5,
  Verbose = 6,
}

type LocationArg =
  | {
      room: Room;
    }
  | {
      pos: RoomPosition;
    }
  | Room
  | RoomPosition
  | string;

const Separator = '<span style="color:#6e6770"> &rsaquo; </span>';
export class Logger {
  private static get settings(): { level: LogLevel } {
    return getMemoryRef('logger', { level: LogLevel.Warn });
  }
  private readonly name: string;
  constructor(type: new () => never) {
    this.name = type.name;
  }

  public static setLogLevel(level: LogLevel) {
    this.settings.level = level;
  }

  private getRoomName(room: LocationArg): string {
    if (typeof room === 'string') {
      return room;
    }

    if ('room' in room) {
      return room.room.name;
    }

    if ('pos' in room) {
      return room.pos.roomName;
    }

    if ('roomName' in room) {
      return room.roomName;
    }

    return room.name;
  }

  private log(
    message: string,
    location: LocationArg | undefined,
    level: LogLevel,
    color = '#fff'
  ) {
    if (level > Logger.settings.level) {
      return;
    }

    let output = this.name;
    output += Separator;
    if (location) {
      const roomName = this.getRoomName(location);
      output += `<a href="#!/room/${Game.shard.name}/${roomName}">${roomName}</a>`;
      output += Separator;
    }
    output += message;
    console.log(`<span style="color:${color}">${output}</span>`);
  }

  public alert(message: string, location?: LocationArg) {
    this.log(message, location, LogLevel.Alert, '#ff00d0');
  }

  public error(message: string, location?: LocationArg) {
    this.log(message, location, LogLevel.Error, '#e50000');
  }

  public warning(message: string, location?: LocationArg) {
    this.log(message, location, LogLevel.Warn, '#f4c542');
  }

  public info(message: string, location?: LocationArg) {
    this.log(message, location, LogLevel.Info, '#efefef');
  }

  public debug(message: string, location?: LocationArg) {
    this.log(message, location, LogLevel.Debug, '#a6a4a6');
  }

  public verbose(message: string, location?: LocationArg) {
    this.log(message, location, LogLevel.Verbose, '#6e6770');
  }
}
