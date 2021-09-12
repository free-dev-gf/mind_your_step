import { _decorator, Component, AudioSource, AudioClip } from "cc";
const { ccclass, property } = _decorator;

@ccclass("AudioController")
export class AudioController extends Component { 

    @property(AudioSource)
    public audio: AudioSource = null!;

    @property(AudioClip)
    public sound: AudioClip = null!;   

    play () {
        this.audio.play();
    }

    pause () {
        this.audio.pause();
    }

    playOneShot () {
        this.audio.playOneShot(this.sound, 1);
    }
}