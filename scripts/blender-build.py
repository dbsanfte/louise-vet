"""Rebuild original game assets locally or through desktop Blender MCP."""
import argparse
import asyncio
import os
from pathlib import Path
import subprocess

PROJECT = Path(__file__).resolve().parent.parent


async def build_with_mcp(scripts):
    # Headless builds use only the Python standard library, without an MCP server.
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    root = os.environ.get('BLENDER_PROJECT_ROOT', 'C:/Users/david/OneDrive/Desktop/vet-game')
    params = StdioServerParameters(
        command='uvx', args=['blender-mcp==1.9.1'],
        env={**os.environ, 'BLENDER_HOST': os.environ.get('BLENDER_HOST', 'host.docker.internal'),
             'BLENDER_MCP_DISABLE_TELEMETRY': '1'},
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            for script in scripts:
                result = await session.call_tool('execute_blender_code', {
                    'code': 'PROJECT_ROOT = ' + repr(root) + '\n' + script.read_text(),
                    'user_prompt': "Rebuild the original models for Louise's Vet Office in their own asset scene and export them into the project.",
                })
                messages = [item.text for item in result.content if hasattr(item, 'text')]
                for message in messages:
                    print(message)
                if getattr(result, 'isError', getattr(result, 'is_error', False)) or any(message.startswith('Error') for message in messages):
                    raise RuntimeError('Blender asset build failed')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--headless', action='store_true', help='Use local Blender without desktop MCP.')
    scope = parser.add_mutually_exclusive_group()
    scope.add_argument('--examination', action='store_true', help='Build anatomy and instruments only.')
    scope.add_argument('--room', action='store_true', help='Build the connected examination room.')
    scope.add_argument('--leisure', action='store_true', help='Build modular clinic rooms and amusements.')
    scope.add_argument('--town', action='store_true', help='Build Hookville scenery only.')
    scope.add_argument('--park', action='store_true', help='Build the park and ducks.')
    scope.add_argument('--pets', action='store_true', help='Build articulated pet breeds and avian anatomy.')
    scope.add_argument('--emergencies', action='store_true', help='Build emergency stations, engine and rescue equipment.')
    scope.add_argument('--vehicles', action='store_true', help='Build the four ordinary traffic vehicles.')
    scope.add_argument('--street', action='store_true', help='Build lampposts, hydrants and dog-walk props.')
    scope.add_argument('--all', action='store_true', help='Build all characters, rooms, town scenery, anatomy and instruments.')
    args = parser.parse_args()
    scripts = [] if args.examination or args.town or args.leisure or args.room or args.pets or args.park or args.emergencies or args.vehicles or args.street else [PROJECT / 'scripts/create-blender-assets.py']
    if args.examination or args.all:
        scripts.append(PROJECT / 'scripts/create-examination-assets.py')
    if args.town or args.all:
        scripts.append(PROJECT / 'scripts/create-town-assets.py')
    if args.leisure or args.all:
        scripts.append(PROJECT / 'scripts/create-clinic-leisure.py')
    if args.room or args.all:
        scripts.append(PROJECT / 'scripts/create-exam-room.py')
    if args.pets or args.all:
        scripts.append(PROJECT / 'scripts/create-pet-models.py')
    if args.park or args.all:
        scripts.append(PROJECT / 'scripts/create-park-assets.py')
    if args.emergencies or args.all:
        scripts.append(PROJECT / 'scripts/create-emergency-assets.py')
    if args.vehicles or args.all:
        scripts.append(PROJECT / 'scripts/create-vehicle-assets.py')
    if args.street or args.all:
        scripts.append(PROJECT / 'scripts/create-street-assets.py')
    if args.headless:
        for script in scripts:
            subprocess.run(
                ['blender', '--background', '--factory-startup', '--python-exit-code', '1', '--python', str(script)],
                env={**os.environ, 'BLENDER_PROJECT_ROOT': os.environ.get('BLENDER_PROJECT_ROOT', str(PROJECT))},
                check=True,
            )
    else:
        asyncio.run(build_with_mcp(scripts))


if __name__ == '__main__':
    main()
