import { newHogCallable, newHogClosure, VMState } from '@posthog/hogvm'
import { actions, kea, listeners, path, reducers } from 'kea'
import api from 'lib/api'
import { execHog } from 'lib/hog'

import type { hogReplLogicType } from './hogReplLogicType'

export interface ReplChunk {
    code: string
    result?: string
    print?: string
    error?: string
    bytecode?: any[]
    locals?: any[]
    state?: any
    status: 'pending' | 'success' | 'error'
}

export const hogReplLogic = kea<hogReplLogicType>([
    path(['scenes', 'debug', 'HogRepl']),
    actions({
        runCode: (code: string) => ({ code }),
        setResult: (index: number, result?: string, error?: string) => ({ index, result, error }),
        print: (index: number, line?: string) => ({ index, line }),
        setBytecode: (index: number, bytecode: any[], locals: any[]) => ({ index, bytecode, locals }),
        setVMState: (index: number, state: any) => ({ index, state }),
    }),
    reducers({
        replChunks: [
            [] as ReplChunk[],
            {
                runCode: (state, { code }) => [...state, { code, status: 'pending' } as ReplChunk],
                setResult: (state, { index, result, error }) =>
                    state.map((chunk, i) =>
                        i === index ? { ...chunk, result, error, status: error ? 'error' : 'success' } : chunk
                    ),
                setBytecode: (state, { index, bytecode, locals }) =>
                    state.map((chunk, i) => (i === index ? { ...chunk, bytecode, locals } : chunk)),
                print: (state, { index, line }) =>
                    state.map((chunk, i) =>
                        i === index ? { ...chunk, print: (chunk.print ? chunk.print + '\n' : '') + line } : chunk
                    ),
                setVMState: (state, { index, state: vmState }) =>
                    state.map((chunk, i) => (i === index ? { ...chunk, state: vmState } : chunk)),
            },
        ],
    }),
    listeners(({ actions, values }) => ({
        runCode: async ({ code }) => {
            const options = {
                functions: {
                    print: (value: any) => {
                        actions.print(index, String(value))
                    },
                },
            }
            const index = values.replChunks.length - 1
            // find last chunk that has locals
            let lastLocals: ReplChunk['locals']
            let lastState: ReplChunk['state']
            for (let i = index; i >= 0; i--) {
                if (!lastLocals && values.replChunks[i].locals) {
                    lastLocals = values.replChunks[i].locals
                }
                if (!lastState && values.replChunks[i].state) {
                    lastState = values.replChunks[i].state
                }
                if (lastState && lastLocals) {
                    break
                }
            }
            try {
                const res = await api.hog.create(code, lastLocals)
                const [_h, version, ...bytecode] = res.bytecode
                const locals = res.locals
                actions.setBytecode(index, bytecode, locals)

                const nextBytecode = [_h, version]
                for (const replChunk of values.replChunks) {
                    if (replChunk.bytecode) {
                        nextBytecode.push(...replChunk.bytecode)
                    }
                }
                const ip = nextBytecode.length - bytecode.length
                if (nextBytecode[nextBytecode.length - 1] === 35) {
                    nextBytecode.pop()
                }
                const nextStack = [...(lastState?.stack ?? [])]
                if (nextStack.length !== lastLocals?.length) {
                    nextStack.splice(lastLocals?.length ?? 0)
                }
                const state: VMState = {
                    stack: nextStack ?? [],
                    bytecode: nextBytecode,
                    callStack: [
                        {
                            ip: ip,
                            chunk: 'root',
                            stackStart: 0,
                            argCount: 0,
                            closure: newHogClosure(
                                newHogCallable('main', {
                                    name: '',
                                    argCount: 0,
                                    upvalueCount: 0,
                                    ip: ip,
                                    chunk: 'root',
                                })
                            ),
                        },
                    ],
                    upvalues: lastState?.upvalues ?? [],
                    ops: lastState?.ops ?? 0,
                    asyncSteps: lastState?.asyncSteps ?? 0,
                    declaredFunctions: lastState?.declaredFunctions ?? {},
                    throwStack: lastState?.throwStack ?? [],
                    maxMemUsed: lastState?.maxMemUsed ?? 0,
                    syncDuration: lastState?.syncDuration ?? 0,
                }
                const result = execHog(state, options)

                // Set the result
                const response =
                    (result.state?.stack?.length ?? 0) > 0
                        ? result.state?.stack?.[result.state.stack.length - 1]
                        : 'null'
                actions.setResult(index, String(response))
                actions.setVMState(index, result.state)
            } catch (error: any) {
                // Handle errors
                console.error(error)
                actions.setResult(index, undefined, error.toString())
            }
        },
    })),
])
