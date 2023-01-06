export const DEFAULT_PREFS = {
	installed: true,///
	fieldFrom: 0,
	fieldToCc: 0,
	fieldDate: 0,
	fieldDateCustom: "%D3%, %M3% %d2% %Y% %h1%:%i%:%s%%a% (%z%)",
	fieldDate24Hour: false,
	fieldDateShortDay: true,
	fieldDateShortMonth: true,
	fieldTimeZone: 0,
	locale: null,
	fieldOrder: ["from","to","cc","replyto","date","subject"],
	fieldHeaderFieldNames: {
		from: "From",
		to: "To",
		cc: "Cc",
		replyto: "Reply-To",
		date: "Date",
		subject: "Subject"
	},
	activeHeaderFieldCount: 6,
	fontFace: 5,
	fontFaceCustom: "Tahoma",
	fontSize: 13,
	fontColor: "#000",
	boldFieldNames: true,
	lineSeparatorWidth: 2,
	lineSeparatorColor: "#B4CDD9",
	lineSeparatorStyle: "solid",
	removeSeparatorLine: false,
	exampleDateValue: 1667679789000,
	dateTimeOptions: {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour12: true,
		hour: "2-digit",
		minute: "numeric",
		second: "numeric",
		timeZone: "UTC",
		timeZoneName: "longOffset"
	}
};