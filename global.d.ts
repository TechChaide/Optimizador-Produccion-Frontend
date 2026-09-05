// Provide typed module declarations for static assets used by the project.
// This helps TypeScript accept side-effect imports (e.g. import '@/app/globals.css')
// and module imports for images and styles.
declare module '*.css' {
	const content: { [className: string]: string } | string;
	export default content;
}

declare module '@/app/globals.css' {
	const content: { [className: string]: string } | string;
	export default content;
}

// Match any path that ends in 'app/globals.css' so relative imports that
// include the 'src' folder are also covered by this declaration.
declare module '*app/globals.css' {
	const content: { [className: string]: string } | string;
	export default content;
}

// Also accept any module that ends with 'globals.css'. This is the broadest
// catch-all and will cover the import in the root layout regardless of
// whether it's imported via an alias or a relative path.
declare module '*globals.css' {
	const content: { [className: string]: string } | string;
	export default content;
}

// Explicitly accept the relative path used in the root layout file for the
// global css so the side-effect import doesn't raise an error.
declare module '../src/app/globals.css' {
	const content: { [className: string]: string } | string;
	export default content;
}

declare module '*.scss' {
	const content: { [className: string]: string } | string;
	export default content;
}

declare module '*.sass' {
	const content: { [className: string]: string } | string;
	export default content;
}

declare module '*.less' {
	const content: { [className: string]: string } | string;
	export default content;
}

declare module '*.png' {
	const src: string;
	export default src;
}

declare module '*.jpg' {
	const src: string;
	export default src;
}

declare module '*.jpeg' {
	const src: string;
	export default src;
}

declare module '*.svg' {
	const src: string;
	export default src;
}

export {};
