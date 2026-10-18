import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {UnavailableStatus} from '../src/App';

(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;

describe('live content unavailable state',()=>{
  afterEach(()=>{vi.restoreAllMocks();document.body.innerHTML=''});

  it('shows only the neutral retry state, not the valid empty edition message',async()=>{
    const container=document.createElement('div'); document.body.append(container); const root=createRoot(container); const retry=vi.fn();
    await act(async()=>{root.render(<UnavailableStatus message="The edition is temporarily unavailable. Please try again shortly." retry={retry}/>)});
    expect(container.textContent).toContain('Live content unavailable');
    expect(container.textContent).toContain('Retry');
    expect(container.textContent).not.toContain('No published stories are available yet.');
    await act(async()=>{container.querySelector('button')?.click()});
    expect(retry).toHaveBeenCalledOnce();
    await act(async()=>{root.unmount()});
  });
});
