declare function setChars(chars: string): void;
declare function captcha({size, style}?: {
    size?: number;
    style?: number;
}): {
    buffer: any;
    token: any;
};
export { setChars, captcha };
