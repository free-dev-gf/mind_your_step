import { _decorator, Component, Prefab, instantiate, Node, CCInteger, Vec3, Label, ParticleSystem } from 'cc';
import { AudioController } from './AudioController';
import { PlayerController } from './PlayerController';
const { ccclass, property } = _decorator;

// 赛道格子类型，坑（BT_NONE）或者实路（BT_STONE）
enum BlockType {
    BT_NONE,
    BT_STONE,
};
enum GameState {
    GS_INIT,
    GS_PLAYING,
    GS_END,
};

@ccclass("GameManager")
export class GameManager extends Component {
    @property({type: Label})
    public stepsLabel: Label | null = null;
    // 赛道预制
    @property({ type: Prefab })
    public cubePrfb: Prefab | null = null;
    // 赛道初始长度
    @property
    public initRoadLength = 30;
    // 赛道最大长度
    @property
    public roadMaxLength = 500;
    private _road: BlockType[] = [];

    @property({ type: PlayerController })
    public playerCtrl: PlayerController | null = null;

    @property({ type: Node })
    public startMenu: Node | null = null;
    @property({ type: Node })
    public endMenu: Node = null!;
    @property({ type: Label })
    public endTitle: Label = null!;
    @property({ type: Label })
    public endScore: Label = null!;
    @property({ type: Label })
    public endTime: Label = null!;
    @property({ type: CCInteger })
    // 落地后最大停留时长 秒
    private _maxStayDuration = 2;
    // 当前累计停留时长
    private _curStayDuration = 0;
    // 游戏当前状态
    private _curState = GameState.GS_INIT;
    // 当剩余赛道长度不足时生成新赛道
    private _refreshStep = 10;
    // 生成新的赛道后如果玩家没有操作，此时移动的step依然满足生成新赛道的触发条件
    // 在下一次update循环中由会触发，所以加个flag判断，当玩家操作后设置flag为true
    private _canGenRoad = true;
    // 已经生成了几次新赛道
    private _refreshNum = 0;
    // 开始游戏的时间戳
    private _startStamp = 0;

    @property({ type: AudioController })
    public audioController: AudioController | null = null;

    start() {
        this.curState = GameState.GS_INIT;
        this.playerCtrl?.node.on('JumpEnd', this.onPlayerJumpEnd, this);
        this.playerCtrl?.node.on('JumpStart', this.onPlayerJumpStart, this);
    }

    onPlayerJumpStart() {
        this._curStayDuration = 0;
        this._canGenRoad = true;
        this.audioController?.playOneShot();
    }

    onPlayerJumpEnd() {
        if (this.stepsLabel) {
            const moveIndex = this.playerCtrl?.curMoveIndex || 0;
            // 因为在最后一步可能出现步伐大的跳跃，但是此时无论跳跃是步伐大还是步伐小都不应该多增加分数
            this.stepsLabel.string = '' + (moveIndex >= this.roadMaxLength ? this.roadMaxLength : moveIndex);
        }
        this.checkResult();
    }

    backStartMenu() {
        this.curState = GameState.GS_INIT;
    }

    init() {
        this._curStayDuration = 0;
        this._refreshNum = 0;
        // 激活主界面
        if (this.startMenu) {
            this.startMenu.active = true;
        }
        this.endMenu.active = false;
        this.initRoad();
        if (this.playerCtrl) {
            // 禁止接收用户操作人物移动指令
            this.playerCtrl.setInputActive(false);
            // 重置人物位置
            this.playerCtrl.node.setPosition(Vec3.ZERO);
            this.playerCtrl.reset();
        }
    }

    checkResult() {
        const moveIndex = this.playerCtrl?.curMoveIndex || 0;
        if (moveIndex < this.roadMaxLength) {
            // 跳到了坑上
            if (this._road[moveIndex] == BlockType.BT_NONE) {
                this.curState = GameState.GS_END;
            }
        } else {    
            // 跳过了最大长度
            this.curState = GameState.GS_END;
        }
    }

    get curState() {
        return this._curState;
    }

    set curState(value: GameState) {
        this._curState = value;
        switch (value) {
            case GameState.GS_INIT:
                this.init();
                break;
            case GameState.GS_PLAYING:
                this.audioController?.play();
                if (this.startMenu) {
                    this.startMenu.active = false;
                }
                if (this.stepsLabel) {
                    this.stepsLabel.string = '0';   // 将步数重置为0
                }
                // 设置 active 为 true 时会直接开始监听鼠标事件，此时鼠标抬起事件还未派发
                // 会出现的现象就是，游戏开始的瞬间人物已经开始移动
                // 因此，这里需要做延迟处理
                setTimeout(() => {
                    if (this.playerCtrl) {
                        this.playerCtrl.setInputActive(true);
                    }
                }, 0.1);
                break;
            case GameState.GS_END:
                this.audioController?.pause();
                this.endMenu.active = true;
                if (this.playerCtrl!.curMoveIndex > 200) {
                    this.endTitle.string = '不错呦！';
                } else if (this.playerCtrl!.curMoveIndex == 500) {
                    this.endTitle.string = '恭喜过关！';
                } else {
                    this.endTitle.string = '再接再厉！';
                }
                this.endScore.string = '得分：' + this.playerCtrl!.curMoveIndex.toString();
                this.endTime.string = `总耗时：${((new Date().getTime() - this._startStamp) / 1000).toFixed(1)}s`;
                break;
        }
    }

    generateBlocks(startIndex: number, endIndex: number) {
        // 确定好每一格赛道类型
        for (let i = startIndex; i < endIndex; i++) {
            // 确保游戏运行时，人物一定站在实路上
            // 如果上一格赛道是坑，那么这一格一定不能为坑
            if (i === 0 || this._road[i - 1] === BlockType.BT_NONE) {
                this._road.push(BlockType.BT_STONE);
            } else {
                this._road.push(Math.floor(Math.random() * 2));
            }
        }
        // 根据赛道类型生成赛道
        for (let j = startIndex; j < endIndex; j++) {
            let block: Node = this.spawnBlockByType(this._road[j]) as Node;
            // 判断是否生成了道路，因为 spawnBlockByType 有可能返回坑（值为 null）
            if (block) {
                this.node.addChild(block);
                block.setPosition(j, -1.5, 0);
            }
        }
    }

    initRoad() {
        this.node.removeAllChildren();
        this._road = [];
        this.generateBlocks(0, this.initRoadLength);
    }

    generateRoad() {
        this._refreshNum += 1;
        this._canGenRoad = false;
        const deleteBlockNum =
            this._road.slice(0, (this.initRoadLength - this._refreshStep - 10) + this.initRoadLength * --this._refreshNum).filter(r => r === BlockType.BT_STONE).length;
        this.node.children.slice(0, deleteBlockNum).forEach(block => {
            this.node.removeChild(block);
        });
        this.generateBlocks(this._road.length, this._road.length + this.initRoadLength);
    }

    onStartButtonClicked() {
        this.curState = GameState.GS_PLAYING;
        this._startStamp = new Date().getTime();
    }

    spawnBlockByType(type: BlockType) {
        if (!this.cubePrfb) {
            return null;
        }

        let block: Node | null = null;
        // 赛道类型为实路才生成
        switch (type) {
            case BlockType.BT_STONE:
                block = instantiate(this.cubePrfb);
                break;
        }

        return block;
    }

    update (deltaTime: number) {
        if (this.curState === GameState.GS_PLAYING) {
            this._curStayDuration += deltaTime;
            if (this._curStayDuration > this._maxStayDuration) {
                // 停留时长超过最大时长，游戏结束
                this.curState = GameState.GS_END;
            }
            if (this._canGenRoad) {
                const { curMoveIndex = 0 } = this.playerCtrl || {};
                if (this._road.length - curMoveIndex < this._refreshStep) {
                    this.generateRoad();
                }
            }
        }
    }
}