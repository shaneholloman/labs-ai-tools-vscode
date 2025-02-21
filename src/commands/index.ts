// barreli boi
import * as vscode from 'vscode'
import { runPrompt } from './runPrompt';
import { runHotCommand } from './runHotCommand';
import { setProjectDir } from './setProjectDir';
import { setThreadId } from './setThreadId';
import killActivePrompts from './killActivePrompts';
import { registerOpenPrompt, registerPrompt, showRegistryInput } from '../utils/promptRegistery';

type CTX = vscode.ExtensionContext

const commands = (context: CTX) => [
    { id: 'docker.labs-ai-tools-vscode.run-commands', callback: runHotCommand },
    { id: 'docker.labs-ai-tools-vscode.run-workspace-as-prompt', callback: () => runPrompt(context.secrets, 'local-dir') },
    { id: 'docker.labs-ai-tools-vscode.run-file-as-prompt', callback: () => runPrompt(context.secrets, 'local-file') },
    { id: 'docker.labs-ai-tools-vscode.run-prompt', callback: () => runPrompt(context.secrets, 'remote') },
    { id: 'docker.labs-ai-tools-vscode.project-dir', callback: setProjectDir },
    { id: 'docker.labs-ai-tools-vscode.thread-id', callback: setThreadId },
    {
        id: 'docker.labs-ai-tools-vscode.toggle-debug', callback: () => {
            const config = vscode.workspace.getConfiguration('docker.labs-ai-tools-vscode');
            const currentValue = config.get('debug') as boolean;
            config.update('debug', !currentValue, true);
            vscode.window.showInformationMessage(`Debug mode is now ${currentValue ? 'disabled' : 'enabled'}.`);
        }
    },
    { id: 'docker.labs-ai-tools-vscode.kill-active-prompts', callback: killActivePrompts },
    { id: 'docker.labs-ai-tools-vscode.register-prompt', callback: registerPrompt },
    { id: 'docker.labs-ai-tools-vscode.registry', callback: () => showRegistryInput(context) },
    { id: 'docker.labs-ai-tools-vscode.register', callback: () => registerOpenPrompt(context) },
]

export default (context: CTX) => commands(context).map((comm) => vscode.commands.registerCommand(comm.id, comm.callback))