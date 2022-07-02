import classNames from 'classnames';
import { ServerContext } from '@/state/server';
import React, { useEffect, useMemo, useState } from 'react';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import ConsoleShareContainer from '../ConsoleShareContainer';
import StatBlock from '@/components/server/console/StatBlock';
import UptimeDuration from '@/components/server/UptimeDuration';
import { bytesToString, ip, mbToBytes } from '@/lib/formatters';
import { SocketEvent, SocketRequest } from '@/components/server/events';
import {
    faClock,
    faHdd,
    faMemory,
    faMicrochip,
    faScroll,
    faWifi,
} from '@fortawesome/free-solid-svg-icons';
import { capitalize } from '@/lib/strings';

type Stats = Record<'memory' | 'cpu' | 'disk' | 'uptime', number>;

const Limit = ({ limit, children }: { limit: string | null; children: React.ReactNode }) => (
    <>
        {children}
        <span className={'ml-1 text-gray-300 text-[70%] select-none'}>/ {limit || <>&infin;</>}</span>
    </>
);

const ServerDetailsBlock = ({ className }: { className?: string }) => {
    const [ stats, setStats ] = useState<Stats>({ memory: 0, cpu: 0, disk: 0, uptime: 0 });

    const status = ServerContext.useStoreState((state) => state.status.value);
    const connected = ServerContext.useStoreState((state) => state.socket.connected);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);
    const limits = ServerContext.useStoreState((state) => state.server.data!.limits);

    const textLimits = useMemo(
        () => ({
            cpu: limits?.cpu ? `${limits.cpu}%` : null,
            memory: limits?.memory ? bytesToString(mbToBytes(limits.memory)) : null,
            disk: limits?.disk ? bytesToString(mbToBytes(limits.disk)) : null,
        }),
        [limits]
    );

    const allocation = ServerContext.useStoreState((state) => {
        const match = state.server.data!.allocations.find((allocation) => allocation.isDefault);

        return !match ? 'n/a' : `${match.alias || ip(match.ip)}:${match.port}`;
    });

    useEffect(() => {
        if (!connected || !instance) {
            return;
        }

        instance.send(SocketRequest.SEND_STATS);
    }, [instance, connected]);

    useWebsocketEvent(SocketEvent.STATS, (data) => {
        let stats: any = {};
        try {
            stats = JSON.parse(data);
        } catch (e) {
            return;
        }

        setStats({
            memory: stats.memory_bytes,
            cpu: stats.cpu_absolute,
            disk: stats.disk_bytes,
            uptime: stats.uptime || 0,
        });
    });

    return (
        <div className={classNames('grid grid-cols-6 gap-2 md:gap-4', className)}>
            <StatBlock
                icon={faClock}
                title={'Uptime'}
            >
                {status === 'starting' || status === 'stopping' ? (
                    capitalize(status)
                ) : stats.uptime > 0 ? (
                    <UptimeDuration uptime={stats.uptime / 1000} />
                ) : (
                    'Offline'
                )}
            </StatBlock>
            <StatBlock icon={faWifi} title={'Address'}>
                {allocation}
            </StatBlock>
            <StatBlock
                icon={faMicrochip}
                title={'CPU Load'}
                description={limits.cpu
                    ? `This server is allowed to use up to ${limits.cpu}% of the host's available CPU resources.`
                    : 'No CPU limit has been configured for this server.'
                }
            >
                {status === 'offline' ?
                    <span className={'text-gray-400'}>Offline</span>
                    : 
                    <Limit limit={textLimits.cpu}>{stats.cpu.toFixed(2)}%</Limit>
                }
            </StatBlock>
            <StatBlock
                icon={faMemory}
                title={'Memory'}
                description={limits.memory
                    ? `This server is allowed to use up to ${bytesToString(mbToBytes(limits.memory))} of memory.`
                    : 'No memory limit has been configured for this server.'
                }
            >
                {status === 'offline' ? (
                    <span className={'text-gray-400'}>Offline</span>
                ) : (
                    <Limit limit={textLimits.memory}>{bytesToString(stats.memory)}</Limit>
                )}
            </StatBlock>
            <StatBlock
                icon={faHdd}
                title={'Disk'}
                description={limits.disk
                    ? `This server is allowed to use up to ${bytesToString(mbToBytes(limits.disk))} of disk space.`
                    : 'No disk space limit has been configured for this server.'
                }
            >
                {bytesToString(stats.disk)}
            </StatBlock>
            <StatBlock
                icon={faScroll}
                title={'Save Console Logs'}
                description={'Saves the console logs to a file.'}
            >
                <ConsoleShareContainer />
            </StatBlock>
        </div>
    );
};

export default ServerDetailsBlock;
