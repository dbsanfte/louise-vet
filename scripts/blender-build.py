"""Build original GLB assets through Blender MCP. Run with uv run --with mcp."""
import asyncio
import os
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
            for item in result.content:
                if hasattr(item,'text'): print(item.text)
            if getattr(result, 'isError', getattr(result, 'is_error', False)): raise RuntimeError('Blender asset build failed')

asyncio.run(main())
