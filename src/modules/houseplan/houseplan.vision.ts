// src/modules/houseplan/houseplan.vision.ts
import { RoomShape } from './houseplan.state.js';
import { spawn } from 'child_process';
import path from 'path';

export interface PipelineResult {
  totalFloorAreaSqM: number;
  rooms: RoomShape[];
  roomMaterials: Record<string, { wallColor: string; wallTexture: string; floorMaterial: string; floorColor?: string }>;
}

export async function runMcpPipeline(
  imageBase64: string
): Promise<PipelineResult> {
  return new Promise((resolve, reject) => {
    // Resolve absolute path to the Python pipeline script at root of project
    const scriptPath = path.resolve(
      process.cwd(),
      'run_mcp_pipeline.py'
    );

    const py = spawn('python3', [scriptPath], {
      env: {
        ...process.env,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || ''
      }
    });

    let stdoutData = '';
    let stderrData = '';

    py.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    py.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    py.on('close', (code) => {
      if (code !== 0) {
        return reject(
          new Error(`Python script exited with code ${code}. Stderr: ${stderrData}`)
        );
      }
      try {
        const result: PipelineResult = JSON.parse(stdoutData);
        resolve(result);
      } catch (err) {
        reject(
          new Error(
            `Failed to parse Python script output: ${err}. Output: ${stdoutData}`
          )
        );
      }
    });

    // Write base64 string to stdin and close the stream
    py.stdin.write(imageBase64);
    py.stdin.end();
  });
}

export function shoelaceAreaSqM(polygon: { x: number; y: number }[]): number {
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const { x: x1, y: y1 } = polygon[i];
    const { x: x2, y: y2 } = polygon[(i + 1) % polygon.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

