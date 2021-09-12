import { _decorator, Component, Vec3, systemEvent, SystemEvent, EventMouse, Animation, SkeletalAnimation, ParticleAsset, ParticleSystem, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass("PlayerController")
export class PlayerController extends Component {
    @property({type: SkeletalAnimation})
    public CocosAnim: SkeletalAnimation | null = null;
    @property({type: Node})
    public Handle: Node | null = null;
    // 是否接收到跳跃指令
    private _startJump: boolean = false;
    // 跳跃步长
    private _jumpStep: number = 0;
    // 当前跳跃时间
    private _curJumpTime: number = 0;
    // 每次跳跃时长
    private _jumpTime: number = 0.5;
    // 当前跳跃速度
    private _curJumpSpeed: number = 0;
    // 当前角色位置
    private _curPos: Vec3 = new Vec3();
    // 每次跳跃过程中，当前帧移动位置差
    private _deltaPos: Vec3 = new Vec3(0, 0, 0);
    // 角色目标位置
    private _targetPos: Vec3 = new Vec3();
    // 累计移动了多少步 
    public curMoveIndex = 0;

    start() {

    }

    // onMouseUp(event: EventMouse) {
    //     if (event.getButton() === 0) {
    //         this.jumpByStep(1);
    //     }
    //     else if (event.getButton() === 2) {
    //         this.jumpByStep(2);
    //     }
    // }

    setInputActive(active: boolean) {
        if (this.Handle) {
            this.Handle.active = active;
        }
        // if (active) {
        //     systemEvent.on(SystemEvent.EventType.MOUSE_UP, this.onMouseUp, this);
        // } else {
        //     systemEvent.off(SystemEvent.EventType.MOUSE_UP, this.onMouseUp, this);
        // }
    }

    onOneStepClick() {
        this.jumpByStep(1);
    }

    onTwoStepClick() {
        this.jumpByStep(2);
    }

    jumpByStep(step: number) {
        if (this._startJump) {
            return;
        }
        this._startJump = true;
        this.node.emit('JumpStart');
        this._jumpStep = step;
        this._curJumpTime = 0;
        this._curJumpSpeed = this._jumpStep / this._jumpTime;
        this.node.getPosition(this._curPos);
        Vec3.add(this._targetPos, this._curPos, new Vec3(this._jumpStep, 0, 0));
        this.curMoveIndex += step;
        if (this.CocosAnim) {
            this.CocosAnim.getState('cocos_anim_jump').speed = 1.5; // 跳跃动画时间比较长，这里加速播放
            this.CocosAnim.play('cocos_anim_jump'); // 播放跳跃动画
        }
    }

    reset() {
        this.curMoveIndex = 0;
    }

    onOnceJumpEnd() {
        if (this.CocosAnim) {
            this.CocosAnim.play('cocos_anim_idle');
        }
        this.node.emit('JumpEnd', this.curMoveIndex);
    }

    update(deltaTime: number) {
        if (this._startJump) {
            this._curJumpTime += deltaTime;
            if (this._curJumpTime > this._jumpTime) {
                // end
                this.node.setPosition(this._targetPos);
                this._startJump = false;
                this.onOnceJumpEnd();
            } else {
                // tween
                this.node.getPosition(this._curPos);
                this._deltaPos.x = this._curJumpSpeed * deltaTime;
                Vec3.add(this._curPos, this._curPos, this._deltaPos);
                this.node.setPosition(this._curPos);
            }
        }
    }
}
