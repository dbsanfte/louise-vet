"""Build original GLB assets through Blender MCP. Run with uv run --with mcp."""
import asyncio
import os
import argparse
import subprocess
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    code = Path(__file__).with_name('create-blender-assets.py').read_text()
    root = os.environ.get('BLENDER_PROJECT_ROOT', 'C:/Users/david/OneDrive/Desktop/vet-game')
    params = StdioServerParameters(command='uvx', args=['blender-mcp==1.9.1'], env={**os.environ, 'BLENDER_HOST': os.environ.get('BLENDER_HOST','host.docker.internal'), 'BLENDER_MCP_DISABLE_TELEMETRY':'1'})
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool('execute_blender_code', {'code': 'PROJECT_ROOT = '+repr(root)+'\n'+code, 'user_prompt': "Create the original low-poly game assets for Louise's Vet Office in a separate Blender scene and export them into the project."})
            messages=[item.text for item in result.content if hasattr(item,'text')]
            for message in messages: print(message)
            if getattr(result, 'isError', getattr(result, 'is_error', False)) or any(message.startswith('Error') for message in messages):
                raise RuntimeError('Blender asset build failed')

parser=argparse.ArgumentParser(description='Rebuild the original Blender game assets.')
parser.add_argument('--headless',action='store_true',help='Use Blender inside the devcontainer instead of desktop MCP.')
args=parser.parse_args()
if args.headless:
    project=Path(__file__).resolve().parent.parent
    subprocess.run(['blender','--background','--factory-startup','--python-exit-code','1','--python',str(project/'scripts/create-blender-assets.py')],env={**os.environ,'BLENDER_PROJECT_ROOT':os.environ.get('BLENDER_PROJECT_ROOT',str(project))},check=True)
else:
    asyncio.run(main())
