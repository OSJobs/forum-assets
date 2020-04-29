/*global I18n:true */

// Instantiate the object
var I18n = I18n || {};

// Set default locale to english
I18n.defaultLocale = "en";

// Set default pluralization rule
I18n.pluralizationRules = {
  en: function(n) {
    return n === 0 ? ["zero", "none", "other"] : n === 1 ? "one" : "other";
  }
};

// Set current locale to null
I18n.locale = null;
I18n.fallbackLocale = null;

// Set the placeholder format. Accepts `{{placeholder}}` and `%{placeholder}`.
I18n.PLACEHOLDER = /(?:\{\{|%\{)(.*?)(?:\}\}?)/gm;

I18n.SEPARATOR = ".";

I18n.noFallbacks = false;

I18n.isValidNode = function(obj, node, undefined) {
  return obj[node] !== null && obj[node] !== undefined;
};

I18n.lookup = function(scope, options) {
  options = options || {};

  var translations = this.prepareOptions(I18n.translations),
    locale = options.locale || I18n.currentLocale(),
    messages = translations[locale] || {},
    currentScope;

  options = this.prepareOptions(options);

  if (typeof scope === "object") {
    scope = scope.join(this.SEPARATOR);
  }

  if (options.scope) {
    scope = options.scope.toString() + this.SEPARATOR + scope;
  }

  var originalScope = scope;
  scope = scope.split(this.SEPARATOR);

  if (scope.length > 0 && scope[0] !== "js") {
    scope.unshift("js");
  }

  while (messages && scope.length > 0) {
    currentScope = scope.shift();
    messages = messages[currentScope];
  }

  if (messages === undefined && this.extras && this.extras[locale]) {
    messages = this.extras[locale];
    scope = originalScope.split(this.SEPARATOR);

    while (messages && scope.length > 0) {
      currentScope = scope.shift();
      messages = messages[currentScope];
    }
  }

  if (messages === undefined) {
    messages = options.defaultValue;
  }

  return messages;
};

// Merge serveral hash options, checking if value is set before
// overwriting any value. The precedence is from left to right.
//
//   I18n.prepareOptions({name: "John Doe"}, {name: "Mary Doe", role: "user"});
//   #=> {name: "John Doe", role: "user"}
//
I18n.prepareOptions = function() {
  var options = {},
    opts,
    count = arguments.length;

  for (var i = 0; i < count; i++) {
    opts = arguments[i];

    if (!opts) {
      continue;
    }

    for (var key in opts) {
      if (!this.isValidNode(options, key)) {
        options[key] = opts[key];
      }
    }
  }

  return options;
};

I18n.interpolate = function(message, options) {
  options = this.prepareOptions(options);

  var matches = message.match(this.PLACEHOLDER),
    placeholder,
    value,
    name;

  if (!matches) {
    return message;
  }

  for (var i = 0; (placeholder = matches[i]); i++) {
    name = placeholder.replace(this.PLACEHOLDER, "$1");

    if (typeof options[name] === "string") {
      // The dollar sign (`$`) is a special replace pattern, and `$&` inserts
      // the matched string. Thus dollars signs need to be escaped with the
      // special pattern `$$`, which inserts a single `$`.
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#Specifying_a_string_as_a_parameter
      value = options[name].replace(/\$/g, "$$$$");
    } else {
      value = options[name];
    }

    if (!this.isValidNode(options, name)) {
      value = "[missing " + placeholder + " value]";
    }

    var regex = new RegExp(
      placeholder.replace(/\{/gm, "\\{").replace(/\}/gm, "\\}")
    );
    message = message.replace(regex, value);
  }

  return message;
};

I18n.translate = function(scope, options) {
  options = this.prepareOptions(options);
  options.needsPluralization = typeof options.count === "number";
  options.ignoreMissing = !this.noFallbacks;

  var translation = this.findTranslation(scope, options);

  if (!this.noFallbacks) {
    if (!translation && this.fallbackLocale) {
      options.locale = this.fallbackLocale;
      translation = this.findTranslation(scope, options);
    }

    options.ignoreMissing = false;

    if (!translation && this.currentLocale() !== this.defaultLocale) {
      options.locale = this.defaultLocale;
      translation = this.findTranslation(scope, options);
    }

    if (!translation && this.currentLocale() !== "en") {
      options.locale = "en";
      translation = this.findTranslation(scope, options);
    }
  }

  try {
    return this.interpolate(translation, options);
  } catch (error) {
    return this.missingTranslation(scope);
  }
};

I18n.findTranslation = function(scope, options) {
  var translation = this.lookup(scope, options);

  if (translation && options.needsPluralization) {
    translation = this.pluralize(translation, scope, options);
  }

  return translation;
};

I18n.toNumber = function(number, options) {
  options = this.prepareOptions(options, this.lookup("number.format"), {
    precision: 3,
    separator: this.SEPARATOR,
    delimiter: ",",
    strip_insignificant_zeros: false
  });

  var negative = number < 0,
    string = Math.abs(number)
      .toFixed(options.precision)
      .toString(),
    parts = string.split(this.SEPARATOR),
    precision,
    buffer = [],
    formattedNumber;

  number = parts[0];
  precision = parts[1];

  while (number.length > 0) {
    buffer.unshift(number.substr(Math.max(0, number.length - 3), 3));
    number = number.substr(0, number.length - 3);
  }

  formattedNumber = buffer.join(options.delimiter);

  if (options.precision > 0) {
    formattedNumber += options.separator + parts[1];
  }

  if (negative) {
    formattedNumber = "-" + formattedNumber;
  }

  if (options.strip_insignificant_zeros) {
    var regex = {
      separator: new RegExp(options.separator.replace(/\./, "\\.") + "$"),
      zeros: /0+$/
    };

    formattedNumber = formattedNumber
      .replace(regex.zeros, "")
      .replace(regex.separator, "");
  }

  return formattedNumber;
};

I18n.toHumanSize = function(number, options) {
  var kb = 1024,
    size = number,
    iterations = 0,
    unit,
    precision;

  while (size >= kb && iterations < 4) {
    size = size / kb;
    iterations += 1;
  }

  if (iterations === 0) {
    unit = this.t("number.human.storage_units.units.byte", { count: size });
    precision = 0;
  } else {
    unit = this.t(
      "number.human.storage_units.units." +
        [null, "kb", "mb", "gb", "tb"][iterations]
    );
    precision = size - Math.floor(size) === 0 ? 0 : 1;
  }

  options = this.prepareOptions(options, {
    precision: precision,
    format: "%n%u",
    delimiter: ""
  });

  number = this.toNumber(size, options);
  number = options.format.replace("%u", unit).replace("%n", number);

  return number;
};

I18n.pluralizer = function(locale) {
  var pluralizer = this.pluralizationRules[locale];
  if (pluralizer !== undefined) return pluralizer;
  return this.pluralizationRules["en"];
};

I18n.findAndTranslateValidNode = function(keys, translation) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (this.isValidNode(translation, key)) return translation[key];
  }
  return null;
};

I18n.pluralize = function(translation, scope, options) {
  if (typeof translation !== "object") return translation;

  options = this.prepareOptions(options);
  var count = options.count.toString();

  var pluralizer = this.pluralizer(options.locale || this.currentLocale());
  var key = pluralizer(Math.abs(count));
  var keys = typeof key === "object" && key instanceof Array ? key : [key];

  var message = this.findAndTranslateValidNode(keys, translation);

  if (message !== null || options.ignoreMissing) {
    return message;
  }

  return this.missingTranslation(scope, keys[0]);
};

I18n.missingTranslation = function(scope, key) {
  var message = "[" + this.currentLocale() + this.SEPARATOR + scope;
  if (key) {
    message += this.SEPARATOR + key;
  }
  return message + "]";
};

I18n.currentLocale = function() {
  return I18n.locale || I18n.defaultLocale;
};

I18n.enableVerboseLocalization = function() {
  var counter = 0;
  var keys = {};
  var t = I18n.t;

  I18n.noFallbacks = true;

  I18n.t = I18n.translate = function(scope, value) {
    var current = keys[scope];
    if (!current) {
      current = keys[scope] = ++counter;
      var message = "Translation #" + current + ": " + scope;
      if (!_.isEmpty(value)) {
        message += ", parameters: " + JSON.stringify(value);
      }
      // eslint-disable-next-line no-console
      console.info(message);
    }
    return t.apply(I18n, [scope, value]) + " (#" + current + ")";
  };
};

I18n.enableVerboseLocalizationSession = function() {
  sessionStorage.setItem("verbose_localization", "true");
  I18n.enableVerboseLocalization();

  return "Verbose localization is enabled. Close the browser tab to turn it off. Reload the page to see the translation keys.";
};

// shortcuts
I18n.t = I18n.translate;


MessageFormat = {locale: {}};
I18n._compiledMFs = {"logs_error_rate_notice.reached_hour_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected \",\" or \"}\" but \"s\" found. at undefined:1376:10";}, "topic.read_more_MF" : function(d){
var r = "";
r += "There ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "UNREAD";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
r += "is <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>1 unread</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "are <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " unread</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "NEW";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "is ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>1 new</a> topic";
return r;
},
"other" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "are ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " new</a> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " remaining, or ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "browse other topics in ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
return r;
},
"false" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["latestLink"];
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "This topic has ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 post";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " posts";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "ratio";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"low" : function(d){
var r = "";
r += "with a high like to post ratio";
return r;
},
"med" : function(d){
var r = "";
r += "with a very high like to post ratio";
return r;
},
"high" : function(d){
var r = "";
r += "with an extremely high like to post ratio";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
r += "\n";
return r;
}, "too_few_topics_and_posts_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "共有 <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "too_few_topics_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "共有 <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "too_few_posts_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "共有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "logs_error_rate_notice.reached_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b>1 – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>已经达到站点设置限制 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "logs_error_rate_notice.exceeded_hour_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>超出了站点设置中的限制";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "logs_error_rate_notice.exceeded_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b>1 – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>已经超出站点设置限制 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "topic.bumped_at_title_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected [a-zA-Z$_] but \"%u9996\" found. at undefined:1376:10";}, "flagging.delete_confirm_MF" : function(d){
var r = "";
r += "你将删除该用户的";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " and ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "、该账户，并阻止其IP地址 <b>%";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b> 再次注册，并将其邮件地址 <b>%";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> 加入黑名单。你确定这用户是广告散布者吗？";
return r;
}, "admin.user.delete_all_posts_confirm_MF" : function(d){
var r = "";
r += "你将要删除 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " 个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 个主题";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " 个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。确定吗？";
return r;
}};
MessageFormat.locale.en = function ( n ) {
  if ( n === 1 ) {
    return "one";
  }
  return "other";
};

(function() {

  I18n.messageFormat = function(key, options) {
    var fn = I18n._compiledMFs[key];
    if (fn) {
      try {
        return fn(options);
      } catch(err) {
        return err.message;
      }
    } else {
      return 'Missing Key: ' + key;
    }
    return I18n._compiledMFs[key](options);
  };

})();

I18n.translations = {"bs_BA":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Bajt","few":"Bajta","other":"Bajta"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}} hiljada","millions":"{{number}} miliona"}},"dates":{"time":"HH: mm","time_with_zone":"HH: mm (z)","timeline_date":"MMM YYYY","long_no_year_no_time":"MMM D","full_no_year_no_time":"MMMM Do","long_with_year":"MMM D, YYYY h:mm a","long_with_year_no_time":"MMM D, YYYY","full_with_year_no_time":"Do.MMMM.YYYY.","long_date_with_year":"MMM D, 'YY LT","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"MMM D, 'YY","long_date_without_year_with_linebreak":"MMM D \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"MMM D, 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} prije","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c %{count} sekunda","few":"\u003c %{count} sekundi","other":"\u003c %{count} sekundi"},"x_seconds":{"one":"%{count} sekunda","few":"%{count} sekundi","other":"%{count} sekundi"},"less_than_x_minutes":{"one":"\u003c %{count}minute","few":"\u003c %{count}minute","other":"\u003c %{count}minuta"},"x_minutes":{"one":"minutu","few":"minuta","other":"%{count} minuta"},"about_x_hours":{"one":"%{count} sat","few":"%{count}sata","other":"%{count}sati"},"x_days":{"one":"%{count} dan","few":"%{count}dana","other":"%{count}dana"},"x_months":{"one":"%{count} mjesec","few":"%{count}mjeseca","other":"%{count}mjeseci"},"about_x_years":{"one":"%{count} godina","few":"%{count}godine","other":"%{count}godina"},"over_x_years":{"one":"\u003e %{count} godinu","few":"\u003e %{count}godine","other":"\u003e %{count}godina"},"almost_x_years":{"one":"%{count} godina","few":"%{count}godine","other":"%{count}godina"},"date_month":"MMM D","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"%{count} minuta","few":"Par minuta","other":"%{count} minuta"},"x_hours":{"one":"%{count} sahat","few":"Par sahati","other":"%{count} sati"},"x_days":{"one":"%{count} dan","few":"Par dana","other":"%{count} dana"},"date_year":"MMM D, 'YY"},"medium_with_ago":{"x_minutes":{"one":"Prije %{count} minutu","few":"Prije par minuta","other":"%{count} minuta prije"},"x_hours":{"one":"Prije %{count} sahat ","few":"Prije par sahati","other":"%{count} sati prije"},"x_days":{"one":"prije %{count} dan ","few":"Prije par dana ","other":"%{count} dana prije"},"x_months":{"one":"%{count} prije mjesec dana","few":"%{count} mjeseca","other":"%{count} mjeseca"},"x_years":{"one":"%{count} prije godinu dana","few":"%{count} godina","other":"%{count} godina"}},"later":{"x_days":{"one":"Prije %{count} dan","few":"Prije par dana","other":"%{count} dana prije"},"x_months":{"one":"Prije %{count} mjesec","few":"Prije par mjeseci","other":"prije %{count} mjeseci"},"x_years":{"one":"Prije %{count} godinu","few":"Prije par godina","other":"prije %{count} godine/a"}},"previous_month":"Prošli mjesec","next_month":"Sljedeći mjesec","placeholder":"datum"},"share":{"topic_html":"Tema: \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","post":"podijeli link ka ovom postu #%{postNumber}","close":"zatvori","twitter":" Dijeli ovaj link na Twitteru ","facebook":"Dijeli ovaj link na Facebuku","email":"Pošalji ovaj link u email-u"},"action_codes":{"public_topic":"postavio ovu temu kao javno %{when}","private_topic":"postavio ovu temu kao privatno %{when}","split_topic":"razdvoji ovu temu %{when}","invited_user":"pozvan %{who} %{when}","invited_group":"pozvan %{who} %{when}","user_left":"%{who} je izašao iz ovog razgovora u %{when}","removed_user":"uklonjen %{who} %{when}","removed_group":"ukloljen %{who} %{when}","autobumped":"automski drmnuli u %{when}","autoclosed":{"enabled":"zatvoren %{when}","disabled":"otvoren %{when}"},"closed":{"enabled":"zatvoren %{when}","disabled":"otvoren %{when}"},"archived":{"enabled":"arhiviran %{when}","disabled":"dearhiviran %{when}"},"pinned":{"enabled":"zakačen %{when}","disabled":"otkačen %{when}"},"pinned_globally":{"enabled":"zakačen globalno %{when}","disabled":"otkačen %{when}"},"visible":{"enabled":"izlistan %{when}","disabled":"sklonjen %{when}"},"banner":{"enabled":"postavi kao zastavicu %{when}. Pojavljivat će se na vrhu svake stranice sve dok je korisnik ne zatvori.","disabled":"odkloni zastavicu %{when}.Neće se više prikazivati na vrhu svake stranice."},"forwarded":"gornji email proslijeđen"},"topic_admin_menu":"akcije u vezi teme","wizard_required":"Dobrodošli na vaš novi Discourse! Odpočnimo sa \u003ca href='%{url}' data-auto-route='true'\u003ečarobnjakom za postavke\u003c/a\u003e ✨","emails_are_disabled":"Sve odlazeće email poruke su globalno onemogućene od strane administratora. Ni jedna notifikacija bilo koje vrste neće biti poslana.","bootstrap_mode_enabled":"Kako bi olakšali lansiranje vaše nove web stranice, trenutačno ste u \"bootstrap\" načinu rada. Svim novim korisnicima će se dodjeljivati nivo povjerenja 1 i imati uključen dnevni izvještaj dešavanja na forumu preko email-a. Ovo će se automatski isključiti nakon što %{min_users} korisnika prijavi račun na forumu.","bootstrap_mode_disabled":"Bootstrap način rada će biti isključen u toku 24 sata.","themes":{"default_description":"Uobičajen","broken_theme_alert":"Vaša stranica možda neradi jer tema / komponeta ima %{theme} greške.\nUgasi ju kod %{path}"},"s3":{"regions":{"ap_northeast_1":"Azija Pacifik (Tokio)","ap_northeast_2":"Azija Pacifik (Seul)","ap_south_1":"Azija Pacifik (Mumai)","ap_southeast_1":"Azija Pacifik (Singapur)","ap_southeast_2":"Azija Pacifik (Sidnej)","ca_central_1":"Kanada (Centralna)","cn_north_1":"Kina (Peking)","cn_northwest_1":"Kina (Ningxia)","eu_central_1":"EU (Frankfurt)","eu_north_1":"Evropska unia (Stockholm)","eu_west_1":"EU (Irska)","eu_west_2":"EU (London)","eu_west_3":"EU (Pariz)","sa_east_1":"Južna Amerika (Sau Paulo)","us_east_1":"SAD Istok (Sjeverna Virdžinija)","us_east_2":"SAD Istok (Ohio)","us_gov_east_1":"AWS GovCloud (SAD-Istok)","us_gov_west_1":"AWS GovCloud (SAD-Zapad)","us_west_1":"SAD Zapad (Sjeverna Kalifornija)","us_west_2":"SAD Zapad (Oregon)"}},"edit":"izmjeni naslov i kategoriju ove teme","expand":"Proširi","not_implemented":"Nažalost ta funkcionalnost nije još implementirana!","no_value":"Ne","yes_value":"Da","submit":"Potvrdi","generic_error":"Uff, došlo je do greške.","generic_error_with_reason":"Došlo je do greške: %{error}","go_ahead":"Idi naprijed","sign_up":"Kreiraj Nalog","log_in":"Uloguj se","age":"Godište","joined":"Registrovan","admin_title":"Admin","show_more":"prikaži još","show_help":"opcije","links":"Linkovi","links_lowercase":{"one":"Link","few":"Link","other":"linkovi"},"faq":"Česta pitanja","guidelines":"Smjernice","privacy_policy":"Izjava o privatnosti","privacy":"Privatnost","tos":"Uslovi korištenja","rules":"Pravila","conduct":"Kodeks ponašanja","mobile_view":"Mobilni zaslon","desktop_view":"Standardni zaslon","you":"Vi","or":"ili","now":"upravo sada","read_more":"pročitaj više","more":"Više","less":"Manje","never":"nikada","every_30_minutes":"svakih 30 minuta","every_hour":"svaki sat","daily":"dnevno","weekly":"sedmično","every_month":"svaki mjesec","every_six_months":"svakih šest mjeseci","max_of_count":"maksimalno {{count}}","alternation":"ili","character_count":{"one":"{{count}} karakter","few":"{{count}} karaktera","other":"{{count}} karaktera"},"related_messages":{"title":"Povezane Poruke","see_all":"Prikaži \u003ca href=\"%{path}\"\u003esve poruke\u003c/a\u003e od @ %{username} ..."},"suggested_topics":{"title":"Preporučene teme","pm_title":"Preporučene Poruke"},"about":{"simple_title":"O Nama","title":"O Nama %{title}","stats":"Statistika sajta","our_admins":"Naši administratori","our_moderators":"Naši moderatori","moderators":"Moderators","stat":{"all_time":"Ukupno vrijeme","last_7_days":"Zadnjih 7","last_30_days":"Zadnjih 30"},"like_count":"Sviđanja","topic_count":"Tema","post_count":"Objava","user_count":"Korisnici","active_user_count":"Aktivnih korisnika","contact":"Kontaktirajte nas","contact_info":"U slučaju da forum ne radi, molimo kontaktirajte nas na %{contact_info}."},"bookmarked":{"title":"Zabilješka","clear_bookmarks":"Očisti oznaku zabilješke","help":{"bookmark":"Klikni kako bi dodao zabilješku na prvu objavu u temi","unbookmark":"Klikni da ukloniš sve zabilješke iz ove teme"}},"bookmarks":{"created":"zabilježili ste ovu stranicu","not_bookmarked":"sačuvaj ovaj post","remove":"Ukloni zabilješku","confirm_clear":"Dali ste sigurni dali želite izbrisati sve sačuvane stvari iz ove teme?","save":"Sačuvaj","no_timezone":"Još uvijek niste postavili vremensku zonu, tako da nećete biti u mogućnosti koristiti podsjetnike. Postavite vremensku zonu \u003ca href=\"%{basePath}/my/preferences/profile\"\u003ena vašem profilu\u003c/a\u003e.","reminders":{"at_desktop":"Sljedeći put sam za svojim desktop kompjuterom","later_today":"Kasnije danas","tomorrow":"Sutra","next_week":"Sljedeće sedmice","later_this_week":"Kasnije ove sedmice","next_month":"Sljedeći mjesec","custom":"Precizno vrijeme i datum"}},"drafts":{"resume":"Nastavi","remove":"Ukloni","new_topic":"Nacrt nove teme","new_private_message":"Novi nacrt privatne poruke","topic_reply":"skica odgovora","abandon":{"confirm":"Već ste otvorili drugu skicu u ovoj temi. Dali ste sigurni da ju želite napustiti?","yes_value":"Da, otkaži","no_value":"Ne, sačuvaj"}},"topic_count_latest":{"one":"Pogledaj {{count}} novu ili ažuriranu temu","few":"Pogledaj {{count}} nove ili ažurirane teme","other":"Pogledaj {{count}} nove ili ažurirane tema"},"topic_count_unread":{"one":"Pogledaj {{count}} nepročitanu temu","few":"Pogledaj {{count}} nepročitane teme","other":"Pogledaj {{count}} nepročitanih tema"},"topic_count_new":{"one":"Pogledaj {{count}} novu temu","few":"Pogledaj {{count}} nove teme","other":"Pogledaj {{count}} novih tema"},"preview":"pregledaj","cancel":"otkaži","save":"Spremiti promjene","saving":"Spremam...","saved":"Spremljeno!","upload":"Učitaj","uploading":"Učitava se...","uploading_filename":"Učitavanje {{filename}}","clipboard":"clipboard","uploaded":"Učitano!","pasting":"Lijepim...","enable":"Omogući","disable":"Onemogući","continue":"Nastavi","undo":"Vrati nazad","revert":"Vrati naprijed","failed":"Neuspješno","switch_to_anon":"Uđi u privatni način rada","switch_from_anon":"Izađi iz privatnog načina rada","banner":{"close":"Odkaži ovu zastavicu.","edit":"Uredite ovu zastavicu \u003e\u003e"},"pwa":{"install_banner":"Da li želite \u003ca href\u003einstalirati %{title} na ovaj uređaj?\u003c/a\u003e"},"choose_topic":{"none_found":"Nema tema.","title":{"search":"Traži Temu","placeholder":"ovdje ukucajte naslov teme, url ili id"}},"choose_message":{"none_found":"nisam našao nijednu poruku","title":{"search":"Traži poruku","placeholder":"ovdje ukucajte naslov poruke, url ili id"}},"review":{"order_by":"Pordeak po","in_reply_to":"odgovori na","explain":{"why":"objasnite zašto je ovaj objekat završio na listi za čekanje","title":"Ocjenjiv Skor","formula":"Formula","subtotal":"Podsuma","total":"Suma","min_score_visibility":"Minimalni skor za Vidljivost","score_to_hide":"Skor za Skrivanje objave","take_action_bonus":{"name":"preduzeo akciju","title":"Kada član uprave odluči da poduzme akciju, zastavici je dodijeljen bonus."},"user_accuracy_bonus":{"name":"korisnička preciznost","title":"Korisnicima čije su zastave prethodno bivale usaglašene dobivaju bonus."},"trust_level_bonus":{"name":"nivo povjerenja","title":"Ocjenjivi objekti kreirani od strane korisnika sa višim nivoom povjerenja imaju viši skor."},"type_bonus":{"name":"bonus tip","title":"Neki ocjenjivi tipovi mogu zaprimiti bonus od strane osoblja foruma kako bi tim tipovima podigli prioritet"}},"claim_help":{"optional":"Možete tražiti ova da sprijećite ostale da ga pregledaju","required":"VI morate tvrditi stavari prije ih morate cijeniti","claimed_by_you":"Vi ste tvrdili ovu stvar i sad ju možete pregledati ","claimed_by_other":"Ovu stavku može revidirati samo korisnik\u003cb\u003e{{username}}\u003c/b\u003e"},"claim":{"title":"tvrdite ovu temu?"},"unclaim":{"help":"maknite ovu tvrdnju?"},"awaiting_approval":"čekanje odobrenje","delete":"Delete","settings":{"saved":"Spašeno","save_changes":"Spremiti promjene","title":"Postavke","priorities":{"title":"prioriteti koje se mogu pregledati"}},"moderation_history":"povijest moderiranja","view_all":"Pregledaj sve","grouped_by_topic":"Grupisano po temi","none":"Nema stvari za pregled","view_pending":"pogled na čekanju","topic_has_pending":{"one":"Ova tema ima \u003cb\u003e%{count}\u003c/b\u003e post čekanje odobrenja","few":"Ova tema ima \u003cb\u003e{{count}}\u003c/b\u003e postove na čekanju za odobrenje","other":"Ova tema ima \u003cb\u003e{{count}}\u003c/b\u003e postova na čekanju za odobrenje"},"title":"Pregled","topic":"Tema:","filtered_topic":"Filtrirali ste sadržaj koji se može pregledati u jednoj temi.","filtered_user":"User","show_all_topics":"(pokaži sve teme)","deleted_post":"(post izbrisan)","deleted_user":"(korisnik izbrisan)","user":{"bio":"Biografija","website":"Web stranica","username":"Ime","email":"Email","name":"Ime","fields":"Polja"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} (ukupno {{count}} flag)","few":"{{agreed}}, {{disagreed}}, {{ignored}} (ukupno {{count}} zastavica)","other":"{{agreed}}, {{disagreed}}, {{ignored}} (ukupno {{count}}kazni )"},"agreed":{"one":"{{count}}% slaže","few":"{{count}}% slaže","other":"{{count}}% se slaže"},"disagreed":{"one":"{{count}}% se ne slažu","few":"{{count}}% se ne slažu","other":"{{count}}% se ne slažu"},"ignored":{"one":"{{count}}% ignore","few":"{{count}}% ignore","other":"{{count}}% ignorišu"}},"topics":{"topic":"Topic","reviewable_count":"Broji","reported_by":"prijavio","deleted":"[Tema Izbrisana]","original":"(orginalna tema)","details":"detalji","unique_users":{"one":"%{count} user","few":"{{count}} users","other":"{{count}}korisnika "}},"replies":{"one":"%{count} reply","few":"{{count}} replies","other":"{{count}}odgovora "},"edit":"Izmijeni","save":"Sačuvaj","cancel":"Otkaži","new_topic":"Odobravanje ove stvari će napraviti novu temu","filters":{"all_categories":"(sve kategorije)","type":{"title":"Tip","all":"(sve vrste)"},"minimum_score":"Minimalno bodova:","refresh":"Osvježi","status":"Status","category":"Kategorija","orders":{"priority":"Prioritet","priority_asc":"Prioritet (preokrenuti)","created_at":"Napravjeno kod","created_at_asc":"Napravijeno kod (preokrenuti)"},"priority":{"title":"Minimalni prioritet","low":"(bilo koji)","medium":"Srednije","high":"Visoko"}},"conversation":{"view_full":"vidi čitav razgovor"},"scores":{"about":"Ovaj rezultat se izračunava na osnovu nivoa pouzdanosti reportera, tačnosti njihovih prethodnih zastavica i prioriteta stavke koja se prijavljuje.","score":"bodovi","date":"Datum","type":"Tip","status":"Status","submitted_by":"Poslao je","reviewed_by":"Pregledao je"},"statuses":{"pending":{"title":"Na čekanju"},"approved":{"title":"Dozvojeno"},"rejected":{"title":"Odbijeni"},"ignored":{"title":"Ignorisano"},"deleted":{"title":"Isbrisano"},"reviewed":{"title":"(sve pregledano)"},"all":{"title":"(sve)"}},"types":{"reviewable_flagged_post":{"title":"Kažnjen post","flagged_by":"Kaznio je"},"reviewable_queued_topic":{"title":"Tema u redu čekanja"},"reviewable_queued_post":{"title":"Post na čekanju"},"reviewable_user":{"title":"User"}},"approval":{"title":"Post treba odobrenje","description":"Primili smo Vaš novi post ali on treba biti odobren od strane moderatora prije nego bude javno dostupan. Molimo za strpljenje.","pending_posts":{"one":"Imate \u003cstrong\u003e%{count}\u003c/strong\u003e poruku na čekanju.","few":"Imate \u003cstrong\u003e{{count}}\u003c/strong\u003e na čekanju.","other":"Imate \u003cstrong\u003e{{count}}\u003c/strong\u003e na čekanju."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e je objavio/la \u003ca href='{{topicUrl}}'\u003etemu\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eVi\u003c/a\u003e ste objavili \u003ca href='{{topicUrl}}'\u003etemu\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e je odgovorio/la na objavu \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eVi\u003c/a\u003e ste odgovorili na objavu \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e je odgovorio/la na \u003ca href='{{topicUrl}}'\u003etemu\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eYou\u003c/a\u003e replied to \u003ca href='{{topicUrl}}'\u003ethe topic\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e je spomenuo/la \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"7\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e je spomenuo/la\u003ca href='{{user2Url}}'\u003evas\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eVi\u003c/a\u003e ste spomenuli \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Objavio \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Objavili\u003ca href='{{userUrl}}'\u003evi\u003c/a\u003e","sent_by_user":"Poslao \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Poslali \u003ca href='{{userUrl}}'\u003evi\u003c/a\u003e"},"directory":{"filter_name":"filtiraj korisnike","title":"Korisnici","likes_given":"Dato","likes_received":"Primljeno","topics_entered":"Pregledano","topics_entered_long":"Pregledano tema","time_read":"Pročitano puta","topic_count":"Teme","topic_count_long":"Kreirano temi","post_count":"Replike","post_count_long":"Odgovoreno","no_results":"Bez rezultata pretrage.","days_visited":"Posjete","days_visited_long":"Broj dana posjete","posts_read":"Čitaj","posts_read_long":"Pročitano postova","total_rows":{"one":"%{count} korisnik","few":"%{count} korisnika","other":"%{count} korisnika"}},"group_histories":{"actions":{"change_group_setting":"Promjeni grupne postavke","add_user_to_group":"Dodaj korisnika","remove_user_from_group":"Ukloni korisnika","make_user_group_owner":"Napravi vlasnika","remove_user_as_group_owner":"Ukloni vlasnika"}},"groups":{"member_added":"Doodano","member_requested":"zatraženo na","add_members":{"title":"Dodaj članove","description":"Uredi članove ove grupe","usernames":"Korisnička imena"},"requests":{"title":"Zahtjevi","reason":"Reason","accept":"Prihvati","accepted":"prihvaćeno","deny":"odbiti","denied":"odbijeno","undone":"zahtjev izbrsan"},"manage":{"title":"Uredi","name":"Ime","full_name":"Puno ime","add_members":"Dodaj članove","delete_member_confirm":"Ukloni '%{username}' iz grupe '%{group}'?","profile":{"title":"Profil"},"interaction":{"title":"Interakcija","posting":"Objavljivanje","notification":"Obavijest"},"membership":{"title":"Članstvo","access":"Pristup"},"logs":{"title":"Dnevnički zapisi","when":"Kad","action":"Djelo","acting_user":"Djelatni korisnik","target_user":"Ciljani korisnik","subject":"Naslov","details":"Detalji","from":"Od","to":"Ka"}},"public_admission":"Omogući korisnicima da se mogu slobodno učlaniti u grupu (zahtjeva da grupa bude javno otvorena)","public_exit":"Omogući korisnicima da mogu slobodno napustiti grupu","empty":{"posts":"Ne postoje postovi člana ove grupe.","members":"Nema članova u grupi.","requests":"Za ovu grupu nema zahtjeva za članstvo.","mentions":"Nema spominjanja u grupi.","messages":"Nema novih poruka za ovu grupu.","topics":"Nema novih tema od strane članova ove grupe.","logs":"Nema novih logova za ovu grupu."},"add":"Dodaj","join":"Učlani se","leave":"Napusti","request":"Zatraži","message":"Poruka","confirm_leave":"Jeste li sigurni da želite napustiti ovu grupu?","allow_membership_requests":"Dopusti korisnicima da smiju slati molbe za učlanjenje u grupu vlasnicima grupa (Potrebno je da je grupa javno vidljiva)","membership_request_template":"Prilagođeni memorandum kao priložak koji se prikazuje korisnicima prilikom slanja zahtjeva za učlanjenje","membership_request":{"submit":"Poslati zahtjev ","title":"Zahtjev za učlanjenje u @%{group_name}","reason":"Dadnite do znanja vlasnicima grupe zašto baš vi pripadate ovoj grupi"},"membership":"Članstvo","name":"Ime","group_name":"Ime grupe","user_count":"Korisnici","bio":"O grupi","selector_placeholder":"unesi korisničko ime","owner":"vlasnik","index":{"title":"Grupe","all":"Sve grupe","empty":"Vidljive grupe još ne postoje.","filter":"Filtriraj prema tipu grupe","owner_groups":"Grupe koje imam","close_groups":"Zatvorene grupe","automatic_groups":"Automatske grupe","automatic":"Automatsko","closed":"Zatvoreno","public":"Javno","private":"Privatno","public_groups":"Javne grupe","automatic_group":"Automatske grupe","close_group":"Zatvorene grupe","my_groups":"Moje grupe","group_type":"Tip grupe","is_group_user":"Član","is_group_owner":"Vlasnik"},"title":{"one":"Grupa","few":"Grupe","other":"Grupa"},"activity":"Aktivnost","members":{"title":"Članovi","filter_placeholder_admin":"korisničko ime ili email","filter_placeholder":"korisničko ime","remove_member":"Ukloni člana","remove_member_description":"Ukloni \u003cb\u003e%{username}\u003c/b\u003e iz ove grupe","make_owner":"Napravi vlasnikom","make_owner_description":"Napravi\u003cb\u003e%{username}\u003c/b\u003e vlasnikom ove grupe","remove_owner":"Ukloni kao vlasnika","remove_owner_description":"Ukloni \u003cb\u003e%{username}\u003c/b\u003e kao vlasnika ove grupe","owner":"Vlasnik","forbidden":"Nije vam dozvoljeno da vidite članove."},"topics":"Teme","posts":"Postovi","mentions":"Spomenuto","messages":"Poruke","notification_level":"Uobičajen nivo obavještenja za grupne poruke","alias_levels":{"mentionable":"Ko može @spomenuti ovu grupu?","messageable":"Ko može slati poruke ovoj grupi?","nobody":"Niko","only_admins":"Samo admini","mods_and_admins":"Samo moderatori i Admini","members_mods_and_admins":"Samo članovi grupe, moderatori i admini","owners_mods_and_admins":"Samo valsnici grupa,modoratori i administratori","everyone":"Svatko"},"notifications":{"watching":{"title":"Posmatram","description":"Dobit ćete obavijest za svaki naredni post u svakoj narednoj poruci, i broj novih odgovora će biti prikazan."},"watching_first_post":{"title":"Pratiti prve objave","description":"Bićete obaviješteni o novim porukama u ovoj grupi, ali ne i odgovorima na poruke."},"tracking":{"title":"Praćenje","description":"Bićete obaviješteni ukoliko neko spomene vaše @ime ili nešto što je naslovljeno za vas, i broj novih odgovora će biti prikazan."},"regular":{"title":"Normalno","description":"Bićete obaviješteni ukoliko neko spomene vaše @ime ili nešto što je naslovljeno za vas"},"muted":{"title":"Utišano","description":"Nećete biti obaviješteni o bilo kojoj poruci u ovoj grupi."}},"flair_url":"Slika Avatara sposobnosti","flair_url_placeholder":"(Opciono) URL slike ili Font Awesome class","flair_url_description":"Koristite kvadratne slike ne manje od 20px od 20px ili FontAwesome ikone (prihvaćeni formati: \"fa-icon\", \"far fa-icon\" ili \"fab fa-icon\").","flair_bg_color":"Boja pozadine Slike Avatara sposobnosti","flair_bg_color_placeholder":"(Opciono) Hex broj boje","flair_color":"Boja Avatara sposobnosti","flair_color_placeholder":"(Opciono) Hex broj boje","flair_preview_icon":"Preview ikona","flair_preview_image":"Preview slika"},"user_action_groups":{"1":"Dati Lajkovi","2":"Dobijeni Lajkovi","3":"Sačuvano","4":"Teme","5":"Postovi","6":"Odgovori","7":"Spemenute","9":"Citirane","11":"Izmjenjene","12":"Poslato","13":"Inbox","14":"Na čekanju.","15":"Nacrti"},"categories":{"all":"Sve kategorije","all_subcategories":"sve","no_subcategory":"nijedna","category":"Kategorija","category_list":"Prikaži listu kategorija","reorder":{"title":"Preuredi kategorije","title_long":"Reorganizuj listu kategorija","save":"Sačuvaj pozicije","apply_all":"Snimi","position":"Pozicija"},"posts":"Odgovori","topics":"Teme","latest":"Najnovije","latest_by":"zadnje od","toggle_ordering":"toggle ordering control","subcategories":"Podkategorije","topic_sentence":{"one":"%{count} tema","few":"%{count} teme","other":"%{count} tema"},"topic_stat_sentence_week":{"one":"%{count} nova tema u protekloj sedmici.","few":"%{count} nove teme u protekloj sedmici.","other":"%{count} nove teme u protekloj sedmici."},"topic_stat_sentence_month":{"one":"%{count} nova tema u posljednjih mjesec dana.","few":"%{count} nove teme u posljednjih mjesec dana.","other":"%{count} nove teme u posljednjih mjesec dana."},"n_more":"Kategorije (%{count} više) ..."},"ip_lookup":{"title":"forenzika IP adrese","hostname":"Hostname","location":"Lokacija","location_not_found":"(unknown)","organisation":"Organizacija","phone":"Telefon","other_accounts":"Ostali računi sa ovom IP adresom","delete_other_accounts":"Izbriši %{count}","username":"korisničko ime","trust_level":"NP","read_time":"vrijeme čitanja","topics_entered":"pogledano tema","post_count":"# postova","confirm_delete_other_accounts":"Jeste sigurni da želite da izbrišete ove račune?","powered_by":"koristeći \u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e","copied":"koprian"},"user_fields":{"none":"(odaberi opciju)"},"user":{"said":"{{username}}:","profile":"Profil","mute":"Mutiraj","edit":"Uredi Postavke","download_archive":{"button_text":"Preuzmi sve","confirm":"Da li ste sigurni da želite preuzeti svoju objavu?","success":"Preuzimanje je započeto, bit će te obavješteni porukom kada proces bude završen.","rate_limit_error":"Objava može biti preuzeta samo jedanput na dan, molimo vas da pokušate sutra ponovo."},"new_private_message":"Nova poruka","private_message":"Privatne Poruke","private_messages":"Poruke","user_notifications":{"ignore_duration_title":"Zanemari tajmer","ignore_duration_username":"Ime","ignore_duration_when":"Trajanje:","ignore_duration_save":"Zanemari","ignore_duration_note":"Napominjemo da se sve ignoracije automatski uklanjaju nakon isteka trajanja ignoriranja.","ignore_duration_time_frame_required":"Odaberite vremenski okvir","ignore_no_users":"Nemate ignorisanih korisnika.","ignore_option":"Ignorisano","ignore_option_title":"Nećete primati obavijesti koje se odnose na ovog korisnika i sve njihove teme i odgovori će biti skriveni.","add_ignored_user":"Dodaj","mute_option":"Utišan","mute_option_title":"Nećete primati nikakve obavijesti koje se odnose na ovog korisnika.","normal_option":"Normalno","normal_option_title":"Bićete obaviješteni ako vam ovaj korisnik odgovori , citira vas ili vas spomene."},"activity_stream":"Aktivnost","preferences":"Postavke","feature_topic_on_profile":{"open_search":"Odaberi Novu temu","title":"Odaberi temu","search_label":"Traži temu po naslovu","save":"Sačuvaj","clear":{"title":"Clear","warning":"Jeste li sigurni da želite vašu istaknutu temu očistiti?"}},"profile_hidden":"Javni profil ovog korisnika je skriven","expand_profile":"Proširi","collapse_profile":"Spusti","bookmarks":"Zabilješke","bio":"O Meni","timezone":"Vremenska zona","invited_by":"Pozvan od","trust_level":"Nivo povjerenja","notifications":"Obaviještenja","statistics":"Statistika","desktop_notifications":{"label":"Uživo obavjesti","not_supported":"Obavjesti nisu podržane na ovom web pregledniku.","perm_default":"Upali obavjesti","perm_denied_btn":"Zabranjen pristup","perm_denied_expl":"Odbili ste dozvolu za slanje notifikacija. Omogućite ih kroz postavke vašeg pretraživača.","disable":"Isključi obavjesti","enable":"Uključi obavijesti","each_browser_note":"Napomena: Ovu opciju morate promjeniti na svakom pregledniku.","consent_prompt":"Da li želite uživo obavjesti kada neko odgovori na vaše objave? "},"dismiss":"Odpusti","dismiss_notifications":"Odpusti sve","dismiss_notifications_tooltip":"Markiraj sve nepročitane obavijesti kao pročitane","first_notification":"Vaša prva obavijest! Selektirajte je kako bi započeli.","dynamic_favicon":"Prikaži se računa na ikonu preglednika","theme_default_on_all_devices":"Učinite ovo podrazumevanom temom na svim mojim uređajima","text_size_default_on_all_devices":"Učinite ovo standardnom veličinom teksta na svim mojim uređajima","allow_private_messages":"Dozvoli drugim korisnicima da mi mogu slati privatne poruke","external_links_in_new_tab":"Otvori sve eksterne linkove u novom tab-u","enable_quoting":"Uključi \"citiran odgovor\" za označen tekst","enable_defer":"Omogući odlaganje za označavanje tema nepročitanih","change":"promjeni","featured_topic":"Istaknuta tema","moderator":"{{user}} je moderator","admin":"{{user}} je admin","moderator_tooltip":"Ovaj korisnik je moderator","admin_tooltip":"Ovaj korisnik je admin","silenced_tooltip":"Ovaj korisnik je ušutkan","suspended_notice":"Ovaj korisnike je suspendovan sve do {{date}}.","suspended_permanently":"Ovaj korisnik je suspendovan.","suspended_reason":"Razlog: ","github_profile":"Github","email_activity_summary":"Sažetak aktivnosti","mailing_list_mode":{"label":"Mejling lista - način rada","enabled":"Uključite način rada Mejling lista","instructions":"Ova Postavka nadvladava postavku Sažetak aktivnosti.\u003cbr /\u003e\nIsključene teme (Muted topics) i kategorije nisu uključeni u ovim e-mailovima.\n","individual":"Šalji e-mail za svaku novu objavu","individual_no_echo":"Šalji e-mail za svaki novu objavu izuzev vlastite","many_per_day":"Pošalji mi e-mail za svaku novu objavu (od prilike {{dailyEmailEstimate}} puta po danu)","few_per_day":"Pošalji mi e-mail za svaku novu objavu (od prilike 2 puta po danu)","warning":"Mejling lista način rada je uključen. Postavke email obavjesti su prepravljene."},"tag_settings":"Tagovi","watched_tags":"Gledano","watched_tags_instructions":"Automatski će te gledati sve teme sa ovim tagom. Bit će te obavješteni o svim novim objavama i temama, i također broj novih objava će biti prikazan pored teme.","tracked_tags":"Praćeno","tracked_tags_instructions":"Automatski će te pratiti sve teme sa ovim tagovima. Broj novih objava će se pojaviti pored teme.","muted_tags":"Utišan","muted_tags_instructions":"Nećete biti obavješteni o novim temama sa ovim tagom, i neće biti prikazani u listi Novije.","watched_categories":"Motren","watched_categories_instructions":"Automatski će te gledati sve teme u ovim kategorijama. Bit će te obavješteni o svim novim objavama i temama, i također broj novih objava će biti prikazan pored teme.","tracked_categories":"Praćen","tracked_categories_instructions":"Automatski će te pratiti sve teme u ovim kategorijama. Broj novih objava će se pojaviti pored teme.","watched_first_post_categories":"Prva objava","watched_first_post_categories_instructions":"Bit će te obavješteni samo o prvim objavama u svakoj novoj temi u ovim kategorijama.","watched_first_post_tags":"Prva objava","watched_first_post_tags_instructions":"Bit će te obavješteni o prvoj objavi u svakoj novoj temi sa ovim tagovima.","muted_categories":"Utišan","muted_categories_instructions":"Nećete biti obavešteni ni o čemu o novim temama u ovim kategorijama, i neće se pojaviti u kategorijama ili najnovijim stranicama.","muted_categories_instructions_dont_hide":"Nećete biti obaviješteni o novim temama u ovim kategorijama.","no_category_access":"Kao moderator imate ograničen pristup kategoriji, sačuvati je isključeno.","delete_account":"Izbriši moj račun","delete_account_confirm":"Da li ste sigurni da želite zauvijek izbrisati vas račun? Ova radnja je kasnije nepovratna!","deleted_yourself":"Vaš račun je uspješno izbrisan.","delete_yourself_not_allowed":"Molimo da kontaktirate vlasnike web stranice ukoliko želite da izbrišete vaš račun.","unread_message_count":"Poruke","admin_delete":"Izbriši","users":"Korisnici","muted_users":"Utišani","muted_users_instructions":"Odbij sve notifikacije od ovih korisnika.","ignored_users":"Ignorisano","ignored_users_instructions":"Potisnite sve postove i obavijesti tih korisnika.","tracked_topics_link":"Show","automatically_unpin_topics":"Automatski otkači temu kada dođem do dna","apps":"Aplikacije","revoke_access":"Oduzmi pristup","undo_revoke_access":"Poništi oduzeti pristup","api_approved":"Odobreno:","api_last_used_at":"Zadnje korišteno kod","theme":"Izgled","home":"Uobičajena početna stranica","staged":"Priređen","staff_counters":{"flags_given":"pomoćne prijave","flagged_posts":"prijavljene objave","deleted_posts":"izbrisane objave","suspensions":"suspenzije","warnings_received":"upozorenja"},"messages":{"all":"Sve","inbox":"Inbox","sent":"Poslano","archive":"Arhiva","groups":"Moje grupe","bulk_select":"Izaberi poruke","move_to_inbox":"Idi u inbox","move_to_archive":"Arhiva","failed_to_move":"Greška u pomjeranju označenih poruka (vjerovatni mrežni problemi)","select_all":"Izaberi sve","tags":"Oznake"},"preferences_nav":{"account":"Račun","profile":"Profil","emails":"Email-i","notifications":"Obavijesti","categories":"Kategorije","users":"Korisnici","tags":"Oznake","interface":"Sučelje","apps":"Aplikacije"},"change_password":{"success":"(email poslat)","in_progress":"(šaljem email)","error":"(greška)","action":"Pošalji Email za resetovanje šifre","set_password":"Namjesti šifru","choose_new":"Izaberite novu šifru","choose":"Izaberite šifru"},"second_factor_backup":{"title":"Dva faktorska sigurnosna koda","regenerate":"Regenerate","disable":"Onemogući","enable":"Omogući","enable_long":"Omogućite rezervne kodove","manage":"Upravljajte rezervnim kodovima. Imate \u003cstrong\u003epreostale\u003c/strong\u003e rezervne kodove \u003cstrong\u003e{{count}}\u003c/strong\u003e .","copied_to_clipboard":"Kopirano u međuspremnik","copy_to_clipboard_error":"Pogreška pri kopiranju podataka u međuspremnik","remaining_codes":"Imate \u003cstrong\u003epreostale\u003c/strong\u003e rezervne kodove \u003cstrong\u003e{{count}}\u003c/strong\u003e .","use":"Koristi backup kod","enable_prerequisites":"Morate omogućiti primarni drugi faktor prije generiranja rezervnih kodova.","codes":{"title":"Generirani sigurnosni kodovi","description":"Svaki od ovih rezervnih kodova može se koristiti samo jednom. Držite ih na sigurnom, ali pristupačnom mjestu."}},"second_factor":{"title":"Two Factor Authentication","enable":"Upravljanje autentifikacijom sa dva faktora","forgot_password":"Zaboravili ste password?","confirm_password_description":"Molimo vas da potvrdite šifru kako bi nastavili","name":"Ime","label":"Šifra","rate_limit":"Pričekajte prije pokušaja drugog koda za provjeru autentičnosti.","enable_description":"Skenirajte ovaj QR kod u podržanoj aplikaciji ( \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e - \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e ) i unesite kod za provjeru autentičnosti.\n","disable_description":"Molimo da uneste kod za ovjeru autentičnosti sa vaše aplikacije","show_key_description":"Unesi manuelno","short_description":"Zaštitite svoj račun pomoću jednokratnih sigurnosnih kodova.\n","extended_description":"Dvofaktorna autentifikacija dodaje dodatnu sigurnost vašem računu tako što zahtijeva dodatnu jednokratnu oznaku pored vaše lozinke. Tokeni se mogu generirati na \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid\u003c/a\u003e i \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e uređajima.\n","oauth_enabled_warning":"Imajte na umu da će ulogovanje korištenjem socijalnih mreža biti isključeno u momentu kad uključite two factor authentication (dvofaktorsku ovjeru autentičnosti) na vašem korisničkom računu.","use":"Koristi Authenticator app?","enforced_notice":"Morate omogućiti autentifikaciju s dva faktora prije pristupa ovoj web-lokaciji.","disable":"onemogući","disable_title":"Onemogući Drugi Faktor","disable_confirm":"Jeste li sigurni da želite onemogućiti sve druge faktore?","edit":"Izmijeni","edit_title":"Uredi drugi faktor","edit_description":"Ime drugog faktora","enable_security_key_description":"Kada ste pripremili vaš fizikalni sigurnosni ključ (physical security key), pritisnite ispod dugme Registriraj.","totp":{"title":"Autentikatori zasnovani na tokenu","add":"Novi Authenticator","default_name":"Moj Authenticator"},"security_key":{"register":"Registriraj","title":"Sigurnosni ključevi","add":"Registriraj sigurnosni ključ","default_name":"Glavni sigurnosni ključ","not_allowed_error":"Proces registracije sigurnosnog ključa je ili vremenski istekao ili je odkazan.","already_added_error":"Već ste registrovali ovaj sigurnosni ključ. Nemate potrebe da ga ponovo registrujete.","edit":"Izmijeni sigurnosni ključ","edit_description":"Ime sigurnosnog ključa","delete":"Izbriši"}},"change_about":{"title":"Promjeni O meni","error":"Desila se greška prilikom promjene."},"change_username":{"title":"Change Username","confirm":"Da li ste apsolutno sigurni da želite promijeniti svoje korisničko ime?","taken":"Nažalost, to korisničko ime je zauzeto.","invalid":"To korisničko ime nije validno. Mora sadržavati samo brojeve i slova"},"change_email":{"title":"Promijeni Email","taken":"Nažalost, taj email nije dostupan.","error":"Desila se greška pri promjeni vašeg email-a. Možda se ta email adresa kod nas već koristi?","success":"Poslali smo email na datu email adresu. Molimo vas da tamo slijedite instrukcije za potvrdu aktivacije.","success_staff":"Poslali smo email na vašu trenutnu email adresu. Molimo vas da tamo slijedite instrukcije za potvrdu aktivacije."},"change_avatar":{"title":"Promjeni sliku","letter_based":"Avatar dodjeljen od sistema","uploaded_avatar":"Vaša slika","uploaded_avatar_empty":"Dodajte vašu sliku","upload_title":"Učitajte vašu sliku sa uređaja","image_is_not_a_square":"Upozorenje: morali smo izrezat vašu sliku; nije bila kvadratnog oblika."},"change_profile_background":{"title":"Profil zaglavlja","instructions":"Profili zaglavlja će biti centrirani i imati standardno širinu od 1110 piksela."},"change_card_background":{"title":"Pozadina Korisničke kartice","instructions":"Pozadinske slike će biti centrirane i imati standard širinu od 590 pixela."},"change_featured_topic":{"title":"Istaknuta tema","instructions":"Link na ovu temu će biti prikazan na vašoj korisničkoj kartici i profilu."},"email":{"title":"Email","primary":"Primarni Email","secondary":"Sekundari Emailovi","no_secondary":"Nema sekundarnih emailova","sso_override_instructions":"E-pošta se može ažurirati od SSO provajdera.","instructions":"Nikada nije prikazan javnosti.","ok":"Izgleda dobro. Poslat ćemo email sa potvrdom.","invalid":"Molimo vas da unesete validnu email adresu.","authenticated":"Vaš email je ovjeren od strane {{provider}}.","frequency_immediately":"Slati ćemo vam e-mail obavijesti odmah na novo, ukoliko niste pročitali sadržaj koji smo vam prvobitno e-mailom poslali.","frequency":{"one":"Poslaćemo vam email samo u slučaju da vas nismo vidjeli u zadnjoj minuti.","few":"Poslaćemo vam email samo u slučaju da vas nismo vidjeli u zadnje{{count}} minute.","other":"Poslaćemo vam email samo u slučaju da vas nismo vidjeli u zadnjih {{count}} minuta."}},"associated_accounts":{"title":"Povezani računi","connect":"Poveži","revoke":"Revoke","cancel":"Otkaži","not_connected":"(nije povezano)","confirm_modal_title":"Povezani %{provider} račun","confirm_description":{"account_specific":"Vaš %{provider} račun %{account_description} će biti korišten za autentifikaciju.","generic":"Vaš %{provider} račun će biti korišten za prijavu."}},"name":{"title":"Ime","instructions":"vaše puno ime (opciono)","instructions_required":"Vaše puno ime","too_short":"Vaše ime je prekratko.","ok":"Vaše ime izgleda ok."},"username":{"title":"Nadimak","instructions":"unikatno, bez tipke praznog prostora, kratko","short_instructions":"Ljudi vas mogu spomenuti preko @{{username}}.","available":"Vaš nadimak je dostupan.","not_available":"Nije dostupan. Pokušaj {{suggestion}}?","not_available_no_suggestion":"Nedostupno","too_short":"Vaše korisničko ime je prekratako.","too_long":"Vaše korisničko ime je predugačko.","checking":"Provjeravamo dostupnost...","prefilled":"Email je već u upotrebi kod ovog korisničkog imena"},"locale":{"title":"Jezik sučelja","instructions":"Jezik sučelja korisnika. Stupit će na snagu čim osvježite web stranicu.","default":"(default)","any":"bilo koji"},"password_confirmation":{"title":"Ponovite šifru"},"auth_tokens":{"title":"Nedavno korišteni uređaji","ip":"IP","details":"Detalji","log_out_all":"Odjavite sve","active":"aktivan sada","not_you":"Ne vi?","show_all":"Prikaži sve ({{count}})","show_few":"Prikaži manje","was_this_you":"Jesi li to bio ti?","was_this_you_description":"Ako niste bili vi, preporučujemo vam da promijenite lozinku i odjavite se svuda.","browser_and_device":"{{browser}} na {{device}}","secure_account":"zaštiti moj račun","latest_post":"Poslednji ste objavili ..."},"last_posted":"Posljednja objava","last_emailed":"Posljednji mejlovan","last_seen":"Viđen","created":"Registrovan","log_out":"Izloguj se","location":"Lokacija","website":"Sajt","email_settings":"Email","hide_profile_and_presence":"Sakrij moje javne profile i funkcije prisutnosti","enable_physical_keyboard":"Omogućite fizičku podršku za tastaturu na iPad-u","text_size":{"title":"Veličina teksta","smaller":"Manji","normal":"Normalno","larger":"Veći","largest":"Najveći"},"title_count_mode":{"title":"Naslov pozadine  broj prikazivanja:","notifications":"Nove obavijesti","contextual":"Novi sadržaj stranice"},"like_notification_frequency":{"title":"Obavijesti ukoliko se nekome sviđa","always":"Uvijek","first_time_and_daily":"Prvi put kada je objava lajkana i svaki dan","first_time":"Prvi put kada je objava lajkana","never":"Nikad"},"email_previous_replies":{"title":"Uključi predhodne odgovore na objave u dnu e-maila","unless_emailed":"ukoliko nije već poslano","always":"uvijek","never":"nikad"},"email_digests":{"title":"Kada ne posjetim ovdje, pošaljite mi sažetak popularnih tema i odgovora na e-poštu","every_30_minutes":"svakih 30. min","every_hour":"po satu","daily":"dnevno","weekly":"nedeljno","every_month":"svaki mjesec","every_six_months":"svakih šest mjeseci"},"email_level":{"title":"Pošalji mi email kada me neko citira, odgovori na moju objavu, spomene moje korisničko @ime ili pozove me u neku temu","always":"uvijek","only_when_away":"samo kad je odsutan","never":"nikad"},"email_messages_level":"Pošalji mi email kada mi neko pošalje privatnu poruku","include_tl0_in_digests":"Uključi i sadržaj od strane novih korisnika u e-mail Sažetku","email_in_reply_to":"Uključi odlomake sa odgovorenih objava u e-mailovima","other_settings":"Ostalo","categories_settings":"Kategorije","new_topic_duration":{"label":"Posmatraj teme kao nove ukoliko","not_viewed":"nisam ih još pogledao","last_here":"su kreirane od trenutka zadnje posjete","after_1_day":"su kreirane u zadnjem danu","after_2_days":"su kreirane u zadnja dva dana","after_1_week":"su kreirane u zadnjoj sedmici","after_2_weeks":"kreirano u zadnje dvije sedmice"},"auto_track_topics":"Automatski prati teme koje pogledam","auto_track_options":{"never":"nikad","immediately":"odmah","after_30_seconds":"svakih 30. sekundi","after_1_minute":"poslije 1 minute","after_2_minutes":"poslije 2 minute","after_3_minutes":"poslije 3 minute","after_4_minutes":"poslije 4 minute","after_5_minutes":"poslije 5 minuta","after_10_minutes":"poslije 10 minuta"},"notification_level_when_replying":"Kada objavim objavu u temi, postavi tu temu u","invited":{"search":"kucaj da potražiš pozivnice...","title":"Pozivnice","user":"Pozvan korisnik","sent":"Zadnje poslano","none":"Nema pozivnica za prikazati","truncated":{"one":"Prikaz prve pozivnice.","few":"Prikaz prvih {{count}} pozivnica.","other":"Prikaz prvih {{count}} pozivnica."},"redeemed":"Iskorištene pozivnice","redeemed_tab":"Iskorišteno","redeemed_tab_with_count":"Iskorišteno ({{count}})","redeemed_at":"Iskorišteno","pending":"Pozivnice na čekanju","pending_tab":"Na čekanju","pending_tab_with_count":"Na čekanju ({{count}})","topics_entered":"Tema pregledano","posts_read_count":"Objava pregledano","expired":"Ova pozivnica je istekla.","rescind":"Ukloni","rescinded":"Pozivnica uklonjena","rescind_all":"Uklonite sve istekle pozive","rescinded_all":"Uklonjeni su svi istekli pozivi!","rescind_all_confirm":"Jeste li sigurni da želite ukloniti sve pozivnice koje su istekle?","reinvite":"Pošalji ponovno pozivnicu","reinvite_all":"Pošalji ponovno sve pozivnice","reinvite_all_confirm":"Da li ste sigurni da želite poslati ponovno sve pozivnice?","reinvited":"Pozivnica ponovo poslata","reinvited_all":"Sve pozivnice su ponovo poslate!","time_read":"Vrijeme čitanja","days_visited":"Dani posjete","account_age_days":"Starost korisničkog računa u danima","create":"Pošalji Pozivnicu","generate_link":"Kopiraj link za pozivnicu","link_generated":"Link pozivnice je uspješno generisan!","valid_for":"Link pozvinice je validan jedino za ovu e-mail adresu: %{email}","bulk_invite":{"none":"Niste još uvijek nikoga pozvali. Šaljite individualne pozivnice, ili šaljite ka više osoba od jednom \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eučitavanjem liste iz CSV fajla\u003c/a\u003e.","text":"Masovno pozovi koristeći fajl","success":"Fajl je uspješno učitan, dobit će te ukratko obavijest o progresu.","error":"Oprostite, vaš fajl bi trebao biti u CSV formatu.","confirmation_message":"Upravo ćete poslati e-poštom pozivnice svima u prenesenoj datoteci."}},"password":{"title":"Šifra","too_short":"Vaša šifra je prekratka.","common":"Vaša šifra je previše obična.","same_as_username":"Vaš pasword je isti kao vaše korisničko ime.","same_as_email":"Vaš pasword je isti kao vaš email.","ok":"Vaša šifra izgleda uredu.","instructions":"minimalno %{count} karaktera"},"summary":{"title":"Sumirano","stats":"Statistike","time_read":"vrijeme čitanja","recent_time_read":"nedavno vrijeme čitanja","topic_count":{"one":"tema kreirana","few":"teme kreirane","other":"tema kreirano"},"post_count":{"one":"objava kreirana","few":"objave kreirane","other":"objava kreirano"},"likes_given":{"one":"dat","few":"date","other":"dato"},"likes_received":{"one":"primljen","few":"primljene","other":"primljeno"},"days_visited":{"one":"dan posjećeno","few":"dana posjećeno","other":"dana posjećeno"},"topics_entered":{"one":"tema pregledana","few":"tema pregledane","other":"tema pregledano"},"posts_read":{"one":"objava pročitana","few":"objave pročitane","other":"objava pročitano"},"bookmark_count":{"one":"zabilješka","few":"zabilješke","other":"zabilješke"},"top_replies":"Top odgovori","no_replies":"Bez odgovora.","more_replies":"Još odgovora","top_topics":"Top Teme","no_topics":"Nema temi još","more_topics":"Još tema","top_badges":"Top bedževi","no_badges":"Nema još bedževa.","more_badges":"Još bedževa","top_links":"Top linkovi","no_links":"Nema još linkova.","most_liked_by":"Primljen lajk","most_liked_users":"Podijeljen lajk","most_replied_to_users":"Najviše odgovoreno ka","no_likes":"Još uvijek nema lajkova.","top_categories":"Top Kategorije","topics":"Teme","replies":"Postovi"},"ip_address":{"title":"Zadnja IP Adresa"},"registration_ip_address":{"title":"IP Adresa prilikom registracije"},"avatar":{"title":"Profilna slika","header_title":"profil, poruke, zabilješke i preference."},"title":{"title":"Naslov","none":"(ništa)"},"primary_group":{"title":"Primary Group","none":"(ništa)"},"filters":{"all":"Sve"},"stream":{"posted_by":"Objavljeno od","sent_by":"Poslato od","private_message":"poruka","the_topic":"tema"}},"loading":"Učitava se...","errors":{"prev_page":"dok pokušava da učita","reasons":{"network":"Network Greška","server":"Server Greška","forbidden":"Pristup Nedostupan","unknown":"Greška","not_found":"Stranica nije pronađena"},"desc":{"network":"Molimo vas da provjerite vašu konekciju.","network_fixed":"Izgleda da je konekcija uredu.","server":"Error code: {{status}}","forbidden":"Niste ovlašteni da to pogledate.","not_found":"Ups, aplikacija je pokušala učitati URL koji ne postoji.","unknown":"Nešto je krenulo pogrešno."},"buttons":{"back":"Idi nazad","again":"Pokušaj ponovo","fixed":"Učitaj stranicu"}},"modal":{"close":"zatvori"},"close":"Zatvori","assets_changed_confirm":"Ovaj sajt je upravo unaprijeđen. Osvježiti odmah stranicu za novu verziju?","logout":"Izlogovani ste.","refresh":"Osvježi","read_only_mode":{"enabled":"Ovaj sajt je u read only mod-u: Dozvoljeno je čitati. Možete nastaviti sa pregledom, ali odgovaranje na objave, lajkanje i ostale akcije su isključene za sada.","login_disabled":"Ulogovanje je isključeno jer je sajt u read only načinu rada.","logout_disabled":"Odjava je isključena sve dok je sajt u read only tj. samo čitanje je dozvoljeno načinu rada."},"logs_error_rate_notice":{},"learn_more":"saznaj više...","all_time":"ukupno","all_time_desc":"ukupno kreiranih tema","year":"godina","year_desc":"teme kreirane u zadnjih 365 dana","month":"mjesec","month_desc":"teme kreirane u zadnjih 30 dana","week":"nedelja","week_desc":"teme kreirane u zadnjih 7 dana","day":"dan","first_post":"Prva objava","mute":"Utišaj","unmute":"Normalno","last_post":"Objavljeno","time_read":"Učitaj","time_read_recently":"%{time_read} skoro","time_read_tooltip":"%{time_read} ukupno vrijeme čitanja","time_read_recently_tooltip":"%{time_read} ukupno vrijeme čitanja (%{recent_time_read} u zadnjih 60 dana)","last_reply_lowercase":"zadnji odgovor","replies_lowercase":{"one":"odgovor","few":"odgovora","other":"odgovora"},"signup_cta":{"sign_up":"Registruj se","hide_session":"Podsjeti me sutra","hide_forever":"ne hvala","hidden_for_session":"Uredu, pitati ću vas ovo opet sutra. Također u svako doba možete koristiti 'Loguj se' kako bi napravili račun.","intro":"Zdravo! Izgleda da uživate u diskusiji, ali još niste prijavili račun.","value_prop":"Kada kreirate nalog, mi se sjećamo točno onoga što ste pročitali, tako da uvijek dolazite odmah tamo gdje ste stali. Također dobijate obavijesti, ovdje i putem e-maila, kad god vam netko odgovori. I možete dati like postovima da dijelite ljubav. : srce: \\ t"},"summary":{"enabled_description":"Trenutno gledate sažetak ove teme: objave koje drugi članovi smatraju kao najinteresantnije.","description":"Trenutno postoji \u003cb\u003e{{replyCount}}\u003c/b\u003e odgovora.","description_time":"Trenutno postoje \u003cb\u003e{{replyCount}}\u003c/b\u003e odgovora sa procijenjenim vremenom čitanja od \u003cb\u003e{{readingTime}} minuta\u003c/b\u003e.","enable":"Napravi sažetak ove teme","disable":"Prikaži sve objave"},"deleted_filter":{"enabled_description":"Ova tema sadrži obrisane objave, vidljive za administratore dok su za ostale korisnike skrivene.","disabled_description":"Obrisane objave u temi su prikazane.","enable":"Sakrij obrisane objave","disable":"Prikaži obrisane objave"},"private_message_info":{"title":"Privatna poruka","invite":"Pozovi Ostale ...","edit":"Dodaj ili ukloni ...","leave_message":"Da li zaista želite da napustite ovu poruku?","remove_allowed_user":"Da li zaista želite da uklonite {{name}} sa ove privatne poruke?","remove_allowed_group":"Da li zaista želite da uklonite {{name}} sa ove poruke?"},"email":"Email","username":"Ime","last_seen":"Viđen","created":"Kreiran","created_lowercase":"kreiran","trust_level":"Nivo povjerenja","search_hint":"ime","create_account":{"disclaimer":"Registracijom pristajete na \u003ca href='{{privacy_link}}' target='blank'\u003epolitiku privatnosti\u003c/a\u003e i \u003ca href='{{tos_link}}' target='blank'\u003euvjete pružanja usluge\u003c/a\u003e .","title":"Kreiraj korisnički račun","failed":"Nešto je krenulo pogrešno, možda je ovaj email već iskorišten za registraciju, pokušajte sa Zaboravio šifru linkom"},"forgot_password":{"title":"Resetuj šifru","action":"Zaboravio šifru","invite":"Upišite vaš email ili korisničko ime i mi ćemo vam poslati link za resetovanje šifre.","reset":"Resetuj Šifru","complete_username":"Ako se vaš nalog podudara sa korisnikom \u003cb\u003e%{username}\u003c/b\u003e, uskoro ćete primiti email koji će vam objasniti kako da resetujete vašu šifru.","complete_email":"Ako se vaš nalog podudara sa \u003cb\u003e%{email}\u003c/b\u003e, uskoro ćete primiti email koji će vam objasniti kako da resetujete vašu šifru.","complete_username_found":"Pronašli smo račun koji se podudara sa korisničkim imenom \u003cb\u003e%{username}\u003c/b\u003e. Trebali bi uskoro dobiti email sa instrukcijama kako da resetujete vaš password.","complete_email_found":"Pronašli smo račun koji se podudara sa \u003cb\u003e%{email}\u003c/b\u003e. Trebali bi uskoro dobiti email sa instrukcijama kako da resetujete vaš password.","complete_username_not_found":"Nema naloga sa korisničkim imenom \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Nema naloga sa email-om \u003cb\u003e%{email}\u003c/b\u003e","help":"Email još ne stiže? Prvo provjerite vaš spam folder u email pregledniku.\u003cp\u003eNiste sigurni koji email ste koristili? Unesite email adresu i mi ćemo vas obavjestiti da li ista postoji kod nas.\u003c/p\u003e\u003cp\u003eUkoliko nemate više pristup vašoj email kojom ste registrovali korisnički račun, molimo vas da se obratite \u003ca href='%{basePath}/about'\u003enašim administratorima za pomoć.\u003c/a\u003e\u003c/p\u003e","button_ok":"OK","button_help":"Pomoć"},"email_login":{"link_label":"Pošalji mi mejlom moj login link","button_label":"pomoću email-a","complete_username":"Ukoliko korisnički račun se podudara sa \u003cb\u003e%{username}\u003c/b\u003e, trebali bi uskoro dobiti email sa linkom za ulogovanje.","complete_email":"Ukoliko korisnički račun se podudara sa \u003cb\u003e%{email}\u003c/b\u003e, trebali bi uskoro dobiti email sa linkom za ulogovanje.","complete_username_found":"Pronašli smo korisnički račun koji se podudara sa \u003cb\u003e%{username}\u003c/b\u003e, trebali bi uskoro dobiti email sa linkom za ulogovanje.","complete_email_found":"Pronašli smo korisnički račun koji se podudara sa \u003cb\u003e%{email}\u003c/b\u003e, trebali bi uskoro dobiti email sa linkom za ulogovanje.","complete_username_not_found":"Ne postoji korisnički račun koji se podudara sa \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Ne postoji korisnički račun koji se podudara sa \u003cb\u003e%{email}\u003c/b\u003e","confirm_title":"Nastavi ka %{site_name}","logging_in_as":"Prijavite se kao %{email}","confirm_button":"Završi prijavu"},"login":{"title":"Uloguj se","username":"Korisnik","password":"Šifra","second_factor_title":"Two Factor Authentication","second_factor_description":"Molimo da unesete kod za ovjeru autentičnosti sa vaše aplikacije:","second_factor_backup":"Loguj se koristeći backup kod","second_factor_backup_title":"rezevna zaštita za dva faktora","second_factor_backup_description":"Molim ukucajte jedan od vaši rezevni kodova","second_factor":"Loguj se koristeći Authenticator app","security_key_description":"Kada ste pripremili vaš fizikalni sigurnosni ključ (physical security key), pritisnite ispod dugme Prijava pomoću sigurnosnog ključa.","security_key_alternative":"Pokušaj na drugi način","security_key_authenticate":"Prijava pomoću sigurnosnog ključa","security_key_not_allowed_error":"Ovaj proces prijave pomoću sigurnosnog ključa je ili vremenski istekao ili je odkazan.","security_key_no_matching_credential_error":"Nisu pronađeni korisnički podatci koristeći navedeni sigurnosni ključ.","email_placeholder":"email ili korisnik","caps_lock_warning":"Uključena su vam velika slova","error":"Nepoznata greška","cookies_error":"Čini se da je vaš preglednik onemogućio cookies. Možda se nećete moći prijaviti bez da ih prvo omogućite.","rate_limit":"Molimo vas pričekajte prije ponovnog logovanja.","blank_username":"Molimo vas da unesete vaš email ili ime korisničkog računa.","blank_username_or_password":"Molimo vas da unesete vaš email ili ime korisničkog računa, i šifru.","reset_password":"Resetuj Šifru","logging_in":"Ulogujem se...","or":"Or","authenticating":"Autorizacija...","awaiting_activation":"Vaš korisnički račun čeka aktivaciju, koristite Zaboravio šifru link kako bi dobili novi email sa aktivacijkim linkom.","awaiting_approval":"Vaš korisnički račun nije još uvijek odobren od strane administratora. Dobiti ćete email kada bude zvanično aktiviran.","requires_invite":"Žalimo, pristup ka forumu imaju samo članovi koji su primili pozivnicu.","not_activated":"Još uvijek se ne možete ulogovati. Prethodno smo vam poslali email za aktivaciju korisničkog računa na email \u003cb\u003e{{sentTo}}\u003c/b\u003e. Molimo da tamo pratite instrukcije za aktivaciju vašeg računa.","not_allowed_from_ip_address":"Nije moguće se ulogovati sa te IP adrese.","admin_not_allowed_from_ip_address":"Ne možete se logirati kao admin sa te IP adrese.","resend_activation_email":"Kliknite ovdje kako bi poslali ponovo email za aktivaciju korisničkog računa.","omniauth_disallow_totp":"Vaš račun ima aktiviran two factor authentication (dvofaktorsku ovjeru autentičnosti). Molimo da se ulogujete korištenjem šifre (password).","resend_title":"Pošalji ponovo email aktivacije","change_email":"Promijeni email adresu","provide_new_email":"Unesite novu adresu i mi ćemo vam ponovo poslati email potvrde","submit_new_email":"Ažuriraj email adresu","sent_activation_email_again":"We sent another activation email to you at \u003cb\u003e{{currentEmail}}\u003c/b\u003e. It might take a few minutes for it to arrive; be sure to check your spam folder.","sent_activation_email_again_generic":"Poslali smo još jean e-mail za aktivaciju. Može potrajati nekoliko minuta da stigne; obavezno proverite svoj spam folder.","to_continue":"Molimo vas ulogujte se","preferences":"Morate biti ulogovani kako bi mjenjali vaše postavke","forgot":"Ne sjećam se svojih detalja korisničkog imena","not_approved":"Vaš korisnički račun nije još uvijek odobren od strane administratora. Dobiti ćete email kada dobijete mogućnost da se ulogirate.","google_oauth2":{"name":"Google","title":"koristeći Google"},"twitter":{"name":"Twitter","title":"koristeći Twitter"},"instagram":{"name":"Instagram","title":"koristeći Instagram"},"facebook":{"name":"Facebook","title":"koristeći Facebook"},"github":{"name":"GitHub","title":"koristeći GitHub"}},"invites":{"accept_title":"Pozivnica","welcome_to":"Dobrodošli na %{site_name}!","invited_by":"Pozvani ste od:","social_login_available":"Bit ćete također u mogućnosti da se registrujete pomoću sistema ulogovanja od bilo koje socijalne mreže koristeći taj email.","your_email":"Email vašeg korisničkog računa je \u003cb\u003e%{email}\u003c/b\u003e.","accept_invite":"Prihvati pozivnicu","success":"Vaš račun je napravljen i sada ste prijavljeni.","name_label":"Ime","password_label":"Postavi šifru","optional_description":"(opciono)"},"password_reset":{"continue":"Nastavi ka %{site_name}"},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","win10":"Win10","google_classic":"Google Classic","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_only":"Samo kategorije","categories_with_featured_topics":"Kategorije sa Izdvojenim temama","categories_and_latest_topics":"Kategorije i Novije teme","categories_and_top_topics":"Kategorije i Top teme","categories_boxes":"Kutije sa podkategorijama","categories_boxes_with_topics":"Kutije sa istaknutim temama"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt","enter":"Naprijed"},"conditional_loading_section":{"loading":"Obrađuje..."},"category_row":{"topic_count":"{{count}} tema u ovoj kategoriji"},"select_kit":{"default_header_text":"Označava...","no_content":"Nije pronađen traženi pojam","filter_placeholder":"Pretraga...","filter_placeholder_with_any":"Pretražite ili kreirajte ...","create":"Kreiraj: '{{content}}'","max_content_reached":{"one":"Možete označiti samo {{count}} predmet.","few":"Možete označiti samo {{count}} predmeta.","other":"Možete označiti samo {{count}} predmeta."},"min_content_not_reached":{"one":"Označi bar {{count}} predmet.","few":"Označi bar {{count}} predmeta.","other":"Označi bar {{count}} predmeta."},"invalid_selection_length":"Označeno mora biti najmanje {{count}} karaktera dugo."},"date_time_picker":{"from":"Od","to":"Ka","errors":{"to_before_from":"Do danas mora biti kasnije od datuma."}},"emoji_picker":{"filter_placeholder":"Pretraži emotikone","smileys_\u0026_emotion":"Smeješci i osječaj","people_\u0026_body":"Ljudi i Tijelo","animals_\u0026_nature":"Životinje i Priroda","food_\u0026_drink":"Hrana i Piće","travel_\u0026_places":"Putovanje i Mijesta","activities":"Aktivnosti","objects":"Objekti","symbols":"Simboli","flags":"Prijave","recent":"Skoro korišteno","default_tone":"Bez tona","light_tone":"Svijetli ton","medium_light_tone":"Srednje svijetli ton","medium_tone":"Srednji ton","medium_dark_tone":"Srednje tamni ton","dark_tone":"Tamni ton","default":"Sopstveni emotikoni"},"shared_drafts":{"title":"Dijeljene skice","notice":"Ova tema je vidljiva onima koji mogu da vide \u003cb\u003e{{category}}\u003c/b\u003e kategoriju.","destination_category":"Kategorija destinacije","publish":"Objavi dijeljenu skicu","confirm_publish":"Da li ste sigurni da želite objaviti ovu skicu?","publishing":"Objavljujem temu..."},"composer":{"emoji":"Emotikoni :)","more_emoji":"više...","options":"Opcije","whisper":"šapat","unlist":"nelistan","blockquote_text":"Citiranje","add_warning":"Ovo je zvanično upozorenje.","toggle_whisper":" Prekidač za Šapat","toggle_unlisted":"Prekidač za Listan","posting_not_on_topic":"Na koju temu želite da odgovorite?","saved_local_draft_tip":"sačuvano lokalno","similar_topics":"Tvoja tema je slična...","drafts_offline":"skicirano lokalno","edit_conflict":"uredi sukob","group_mentioned_limit":"\u003cb\u003ePažnja!\u003c/b\u003e Spomenuli ste \u003ca href='{{group_link}}'\u003e{{group}}\u003c/a\u003e, međutim ova grupa ima više članova nego što je administrator postavio granicu na spominjanje od maximalno {{max}} korisnika. Stoga niko neće biti obavješten. ","group_mentioned":{"one":"Spominjući {{group}}, obavijestiti će te {{count}} korisnika – da li ste sigurni?","few":"Spominjući {{group}}, obavijestiti će te \u003ca href='{{group_link}}'\u003e{{count}} korisnika\u003c/a\u003e – da li ste sigurni?","other":"Spominjući {{group}}, obavijestiti će te \u003ca href='{{group_link}}'\u003e{{count}} korisnika\u003c/a\u003e – da li ste sigurni?"},"cannot_see_mention":{"category":"Spomenuli ste {{username}} ali isti neće biti obavješteni zbog toga što nemaju pristup ovoj kategoriji. Morate ih dodati u Grupu koja ima pristup ka ovoj kategoriji.","private":"Spomenuli ste {{username}} ali isti neće biti obaviješteni zbog toga što nisu u mogućnosti da vide ovu personalnu poruku. Morate ih prvobitno pozvati u ovu PP tj. Personalnu poruku."},"duplicate_link":"Izgleda da vaš link ka \u003cb\u003e{{domain}}\u003c/b\u003e je već objavljen u temi od strane \u003cb\u003e@{{username}}\u003c/b\u003e u\u003ca href='{{post_url}}'\u003eodgovoru prije {{ago}}\u003c/a\u003e – da li ste sigurni da želite link objaviti ponovno?","reference_topic_title":"RE:{{title}}","error":{"title_missing":"Naslov je obavezan","title_too_short":"Naslov mora biti najmanje {{min}} karaktera","title_too_long":"Naslov ne može biti više od {{max}} karaktera","post_missing":"Objava ne može biti prazna","post_length":"Odgovor mora biti najmanje {{min}} karaktera","try_like":"Dail ste pokušali{{heart}}dugme?","category_missing":"Morate odabrati kategoriju","tags_missing":"Morate odabrati najmanje {{count}} oznaka","topic_template_not_modified":"Molimo da dodate detalje i specifikacije za vašu temu tako što ćete izmijeniti template teme."},"save_edit":"Sačuvaj izmjene","overwrite_edit":"Overwrite Edit","reply_original":"Odgovori na Originalnu temu","reply_here":"Odgovori Ovdje","reply":"Odgovori","cancel":"Otkaži","create_topic":"Započni Temu","create_pm":"Kreiraj Privatnu Poruku","create_whisper":"Šapat","create_shared_draft":"Kreiraj dijeljenu skicu","edit_shared_draft":"Izmijeni dijeljenu skicu","title":"Ili pritisni Ctrl+Enter","users_placeholder":"Dodaj člana","title_placeholder":"O čemu je ova diskusija u jednoj rečenici?","title_or_link_placeholder":"Ukucajte naziv, ili zalijepite link ovdje","edit_reason_placeholder":"zašto pravite izmjenu?","topic_featured_link_placeholder":"Unesite link prikazan sa nazivom","remove_featured_link":"Odstranite link sa teme.","reply_placeholder":"Ovdje kucate vaš tekst. Koristite Markdown, BBcode ili HTML kako bi formatirali isti. Povucite ili zaljepite slike.","reply_placeholder_no_images":"Ovdje kucate tekst odgovor-a. Koristite Markdown, BBCode, ili HTML za formatiranje teksta.","reply_placeholder_choose_category":"Odlućite kategoriju prije nego ovdije pišete","view_new_post":"Pogledaj svoj novi post.","saving":"Spašavam","saved":"Sačuvano!","saved_draft":"Sastav je u toku. Tipkajte kako bi nastavili dalje.","uploading":"Uplodujem...","show_preview":"pokaži pregled \u0026raquo;","hide_preview":"\u0026laquo; sakri pregled","quote_post_title":"Citiraj cjeli post","bold_label":"B","bold_title":"Bold","bold_text":"bold tekst","italic_label":"I","italic_title":"Ukošen","italic_text":"ukošen tekst","link_title":"Link","link_description":"ubaci opis linka","link_dialog_title":"Unesi Link","link_optional_text":"naslov neobavezan","quote_title":"Blok Citat","quote_text":"Citat u bloku","code_title":"Formatiran Tekst","code_text":"Unapred formatirani tekst za 4 razmaka","paste_code_text":"ukucaj ili zalijepi kod ovdje","upload_title":"Učitavanje","upload_description":"unesi opis učitanog","olist_title":"Numerisana lista","ulist_title":"Obična lista","list_item":"Listaj predmet","toggle_direction":"Prekidač smijera","help":"Pomoć za Markdown","collapse":"smanji panel za sastavljanje teksta","open":"otvorite panel za kompozitor","abandon":"zatvori panel za sastav teksta i odkaži skicu teksta","enter_fullscreen":"unesite fullscreen composer","exit_fullscreen":"izlaz iz fullscreen kompozitora","modal_ok":"OK","modal_cancel":"Otkaži","cant_send_pm":"Neuspješno, ne možete slati poruke ka %{username}.","yourself_confirm":{"title":"Da li ste zaboravili da dodate primaoca?","body":"Trenutno ova poruka biješe poslana samo vama!"},"admin_options_title":"Opcione postavke za ovu temu","composer_actions":{"reply":"Odgovori","draft":"Nacrt","edit":"Izmijeni","reply_to_post":{"label":"Odgovori na objavu %{postNumber} od %{postUsername}","desc":"Odgovori na ciljani post"},"reply_as_new_topic":{"label":"Odgovori kao linkana tema","desc":"Kreiraj novu temu linkanu na ovu temu"},"reply_as_private_message":{"label":"Nova poruka","desc":"Kreiraj novu personalnu poruku"},"reply_to_topic":{"label":"Odgovori na temu","desc":"Odgovori na temu, ne ciljajući na neku posebnu objavu"},"toggle_whisper":{"label":"Uključi Šapat","desc":"Šapati su vidljivi samo administratorima"},"create_topic":{"label":"Nova tema"},"shared_draft":{"label":"Dijeljena skica","desc":"Skiciraj temu koja će biti vidljiva samo administratorima"},"toggle_topic_bump":{"label":"Toggle topic bump","desc":"Odgovori bez izmjene zadnjeg datuma odgovora"}},"details_title":"Sažetak","details_text":"Ovaj tekst će biti sakriven"},"notifications":{"tooltip":{"regular":{"one":"%{count} nepregledana obavijest","few":"{{count}} nepregledane obavijesti","other":"{{count}} nepregledanih obavijesti"},"message":{"one":"%{count} nepročitana poruka","few":"{{count}} nepročitane poruke","other":"{{count}} nepročitanih poruka"}},"title":"obaviještenja na spomenuto @ime, odgovori na vaše teme i postove, privatne poruke, itd","none":"Nemate obavijesti trenutno.","empty":"Nema obavještenja.","post_approved":"Vaš post je odobren","reviewable_items":"stvari koje zahtijevaju pregled","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} and %{count} ostali\u003c/span\u003e {{description}}","few":"\u003cspan\u003e{{username}}, {{username2}} i ostalih {{count}}\u003c/span\u003e {{description}}","other":"\u003cspan\u003e{{username}}, {{username2}} i ostalih {{count}} \u003c/span\u003e {{description}}"},"liked_consolidated_description":{"one":"vam se svidio {{count}} vaših postova","few":"vam se svidio {{count}} vaših postova","other":"vam se svidio {{count}} vaših postova"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e je prihvatio vašu pozivnicu","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e je pomjerio {{description}}","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"Zasluženo '{{description}}'","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003eNova tema\u003c/span\u003e {{description}}","group_message_summary":{"one":"{{count}} poruka u vašem {{group_name}} sandučiću","few":"{{count}} poruke u vašem {{group_name}} sandučiću","other":"{{count}} poruka u vašem {{group_name}} sandučiću"},"popup":{"mentioned":"{{username}} vas je spomenuo/la u \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} vas je spomenuo/la u \"{{topic}}\" - {{site_title}}","quoted":"{{username}} vas je citirao/la u \"{{topic}}\" - {{site_title}}","replied":"{{username}} vam je odgovorio/la u \"{{topic}}\" - {{site_title}}","posted":"{{username}} je objavio/la \"{{topic}}\" - {{site_title}}","private_message":"{{username}} vam je poslao/la poruku u \"{{topic}}\" - {{site_title}}","linked":"{{username}} je linkao/la vašu objavu \"{{topic}}\" - {{site_title}}","watching_first_post":"{{username}} je kreirao novu temu \"{{topic}}\" - {{site_title}}","confirm_title":"Obavijesti uključene - %{site_title}","confirm_body":"Uspješno! Obavijesti su sada uključene.","custom":"Obavijest od {{username}} na %{site_title}"},"titles":{"mentioned":"spomenuto","replied":"novi odgovor","quoted":"citirano","edited":"promjenjeno","liked":"novi like","private_message":"nova privatna poruka","invited_to_private_message":"pozvan u privatnu poruku","invitee_accepted":"poziv prihvaćen","posted":"novi post","moved_post":"post maknut","linked":"linked","granted_badge":"dodijeljena značka","invited_to_topic":"pozvan na temu","group_mentioned":"grupa spomenula","group_message_summary":"nove grupne poruke","watching_first_post":"nova tema","topic_reminder":"podsjetnik na temu","liked_consolidated":"novi lajkovi","post_approved":"post odobreno"}},"upload_selector":{"title":"Dodaj sliku","title_with_attachments":"Dodaj sliku ili fajl","from_my_computer":"Sa mog uređaja","from_the_web":"Sa neta","remote_tip":"link do slike http://primjer.com/slika.jpg","remote_tip_with_attachments":"link ka slici ili datoteci {{authorized_extensions}}","local_tip":"Izaberi slike sa svog uređaja","local_tip_with_attachments":"izaberite slike ili fajlove sa vašeg uređaja {{authorized_extensions}}","hint":"(možete i mišom prenijeti vaše slike direktno iz vašeg foldera ovdje)","hint_for_supported_browsers":"također možete povući i ispustiti ili zalijepiti slike u editor teksta","uploading":"Učitavam","select_file":"Izaberi fajl","default_image_alt_text":"slika"},"search":{"sort_by":"Sortiraj po","relevance":"Bitnost","latest_post":"Zadnja objava","latest_topic":"Zadnja tema","most_viewed":"Najviše pregledano","most_liked":"Najviše lajkan","select_all":"Izaberi sve","clear_all":"Očisti sve","too_short":"Vaš termin za pretragu je prekratak.","result_count":{"one":"\u003cspan\u003e%{count} rezultat za\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e","few":"\u003cspan\u003e{{count}}{{plus}} resultata za\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e","other":"\u003cspan\u003e{{count}}{{plus}} rezultata za\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"title":"traži teme, postove, članove ili kategorije","full_page_title":"pretraži teme ili objave","no_results":"Nema rezultata.","no_more_results":"Nema rezultata pretrage.","searching":"Potražujem...","post_format":"#{{post_number}} od {{username}}","results_page":"Pretraži za termin '{{term}}'","more_results":"Postoji više rezultata. Molimo vas da suzite kriterij za pretragu.","cant_find":"Ne možete naći ono što tražite?","start_new_topic":"Možda da započnete novu temu?","or_search_google":"Ili umjesto toga probaj pretražiti pomoću Google-a:","search_google":"Probaj umjesto toga pretražiti pomoću Google-a:","search_google_button":"Google","search_google_title":"Pretraži ovaj sajt","context":{"user":"Traži postove od @{{username}}","category":"Traži #{{category}} kategoriju","topic":"Pretraži ovu temu","private_messages":"Pretraži poruke"},"advanced":{"title":"Napredna tražilica","posted_by":{"label":"Objavljeno od"},"in_category":{"label":"Kategorisano"},"in_group":{"label":"U grupi"},"with_badge":{"label":"Sa bedžom"},"with_tags":{"label":"Označen"},"filters":{"label":"Izbaci samo teme/objave...","title":"Podudaranje u naslovu samo","likes":"Moje lajkovane objave","posted":"Moje objave","watching":"Posmatrane","tracking":"Praćene","private":"U mojim porukama","bookmarks":"Zabilježene","first":"su friške prve objave","pinned":"su zakačene","unpinned":"nisu zakačene","seen":"Pročitane","unseen":"Nepročitane","wiki":"su wiki","images":"uključujući slike","all_tags":"Sve gore navedene oznake"},"statuses":{"label":"Gdje teme","open":"su otvorene","closed":"su zatvorene","archived":"su arhivirane","noreplies":"imaju nula odgovora","single_user":"sadrži jednog korisnika"},"post":{"count":{"label":"Minimalan broj objava"},"time":{"label":"Objavljeno","before":"prije","after":"poslije"}}}},"hamburger_menu":"idi ka drugoj temi, listi ili kategoriji","new_item":"novo","go_back":"go back","not_logged_in_user":"user page with summary of current activity and preferences","current_user":"go to your user page","topics":{"new_messages_marker":"zadnja posjeta","bulk":{"select_all":"Označi sve","clear_all":"Očisti sve","unlist_topics":"Skini teme sa liste","relist_topics":"Listaj teme","reset_read":"Reset Read","delete":"Delete Topics","dismiss":"Odbaci","dismiss_read":"Odbaci sve nepročitane","dismiss_button":"Odbaci...","dismiss_tooltip":"Odbaci samo nove objave ili stopiraj praćenje tema","also_dismiss_topics":"Prestani pratiti ove teme tako da se ubuduće za mene nikad ne prikazuju kao nepročitane ","dismiss_new":"Odpusti Nove","toggle":"preklopi masovno označavanje tema","actions":"Masovno odrađene akcije","change_category":"Postavi kategoriju","close_topics":"Zatvori teme","archive_topics":"Arhiviraj teme","notification_level":"Obavijesti","choose_new_category":"Izaberi novu kategoriju za temu:","selected":{"one":"Označili ste \u003cb\u003e%{count}\u003c/b\u003e temu.","few":"Označili ste \u003cb\u003e{{count}}\u003c/b\u003e teme.","other":"Označili ste \u003cb\u003e{{count}}\u003c/b\u003e teme."},"change_tags":"Zamijeni oznake","append_tags":"Pripoji oznake","choose_new_tags":"Odaberi nove tagove za ove teme:","choose_append_tags":"Odaberi nove oznake kako bi pripojili ovim temama:","changed_tags":"Tagovi ovih tema su izmijenjeni."},"none":{"unread":"Nemate više nepročitanih tema.","new":"Nemate više novih tema.","read":"Niste pročitali nijednu temu.","posted":"Niste odgovorili ni na jednu temu.","latest":"Nema više novih tema. To je tužno.","bookmarks":"Nemate još bookmark-iranih tema.","category":"Nema više tema u {{category}}.","top":"Nema više popularnih tema.","educate":{"new":"\u003cp\u003eVaše nove teme se ovdje pojavljuju.\u003c/p\u003e\u003cp\u003eNačelno, teme se smatraju novim i prikazivat će\u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enova\u003c/span\u003e indikator u slučaju da su objavljena u zadnja 2 dana.\u003c/p\u003e\u003cp\u003ePosjetite svoje \u003ca href=\"%{userPrefsUrl}\"\u003epostavke\u003c/a\u003e ukoliko želite da to izmijenite.\u003c/p\u003e","unread":"\u003cp\u003eVaše nepročitane teme se ovdje pojavljuju.\u003c/p\u003e\u003cp\u003eNačelno, teme su smatrane nepročitanim i prikazivat će brojač nepročitanih poruka\u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e ukoliko ste:\u003c/p\u003e\u003cul\u003e\u003cli\u003eKreirali temu\u003c/li\u003e\u003cli\u003eOdgovorili na temu\u003c/li\u003e\u003cli\u003eČitali temu duže od 4 minuta\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eIli ako ste explicitno označili temu za Praćenje ili Posmatrane preko kontrole obavještenja na dnu svake od tema.\u003c/p\u003e\u003cp\u003ePosjetite vaše \u003ca href=\"%{userPrefsUrl}\"\u003epostavke\u003c/a\u003e ukoliko želite da to izmijenite.\u003c/p\u003e"}},"bottom":{"latest":"Nema više novih tema.","posted":"There are no more posted topics.","read":"Nema više pročitanih tema.","new":"Nema više novih tema.","unread":"Nema više nepročitanih tema.","category":"Nema više tema na kategoriji {{category}}.","top":"Nema više popularnih tema.","bookmarks":"Nema više bookmark-ovanih tema."}},"topic":{"filter_to":{"one":"%{count} objava u temi","few":"{{count}} objave u temi","other":"{{count}} objava u temi"},"create":"Započni Temu","create_long":"Započni novu Temu","open_draft":"Otvori skicu","private_message":"Započni privatnu konverzaciju","archive_message":{"help":"Premjesti poruke u vašu arhivu","title":"Arhiva"},"move_to_inbox":{"title":"Premjesti u Sanduče","help":"Premjesti poruke nazad u Sanduče"},"edit_message":{"help":"Izmijeni prvu objavu ove poruke","title":"Izmijeni poruku"},"defer":{"help":"Označi kao nepročitano","title":"Defer"},"list":"Teme","new":"nova tema","unread":"nepročitana","new_topics":{"one":"%{count} nova tema","few":"{{count}} nove teme","other":"{{count}} nove teme"},"unread_topics":{"one":"%{count} nepročitana tema","few":"{{count}} nepročitane teme","other":"{{count}} nepročitane teme"},"title":"Tema","invalid_access":{"title":"Tema je privatna","description":"Nažalost, trenutno nemate pristup toj temi!","login_required":"Morate se ulogovati kako bi vidjeli tu temu."},"server_error":{"title":"Učitavanje teme nije uspjelo","description":"Nažalost, nismo u mogućnosti učitati tu temu, moguće zbog problema sa konekcijom. Molimo da pokušate ponovo. Ako je problem i dalje prisutan, a nije do konekcije onda molimo vas da nam to prijavite."},"not_found":{"title":"Tema nije pronađena","description":"Nažalost, nismo pronašli tu temu. Možda je uklonjena od strane moderatora?"},"total_unread_posts":{"one":"imate %{count} nepročitanu objavu u ovoj temi","few":"imate {{count}} nepročitane objave u ovoj temi","other":"imate {{count}} nepročitanih objava u ovoj temi"},"unread_posts":{"one":"imate %{count} nepročitanu staru objavu u ovoj temi","few":"imate {{count}} nepročitane stare objave u ovoj temi","other":"imate {{count}} nepročitane stare objave u ovoj temi"},"new_posts":{"one":"imate %{count} novu objavu u ovoj temi od trenutka vaše zadnje posjete","few":"imate {{count}} nove objave u ovoj temi od trenutka vaše zadnje posjete","other":"imate {{count}} nove objave u ovoj temi od trenutka vaše zadnje posjete"},"likes":{"one":"postoji %{count} sviđanje u ovoj temi","few":"postoji {{count}} sviđanja u ovoj temi","other":"postoji {{count}} sviđanja u ovoj temi"},"back_to_list":"Vrati se na Listu Tema","options":"Opcije Teme","show_links":"pokaži linkove unutar ove teme","toggle_information":"uključi detalje teme","read_more_in_category":"Želite da pročitate još? Pogledajte druge teme u kategoriji {{catLink}} ili {{latestLink}}.","read_more":"Želite da pročitate još? {{catLink}} ili {{latestLink}}.","group_request":"Morate zatražiti članstvo u grupi `{{name}}` da biste vidjeli ovu temu","group_join":"Trebate se pridružiti grupi `{{name}}` da biste vidjeli ovu temu","group_request_sent":"Vaš zahtjev za članstvo u grupi je poslan. Bićete obavešteni kada se prihvati.","browse_all_categories":"Pogledajte sve Kategorije","view_latest_topics":"pogledaj posljednje teme","suggest_create_topic":"Zašto ne kreirati novu temu?","jump_reply_up":"jump to earlier reply","jump_reply_down":"jump to later reply","deleted":"Ova tema je obrisana","topic_status_update":{"title":"Trajanje teme","save":"Postavi trajanje","num_of_hours":"Broj sati:","remove":"Ukloni tajmer","publish_to":"Objavi u:","when":"Kada:","public_timer_types":"Trajanje tema","private_timer_types":"Trajanje tema korisnika","time_frame_required":"Odaberite vremenski okvir"},"auto_update_input":{"none":"Označi vremenski period","later_today":"Kasnije danas","tomorrow":"Sutra","later_this_week":"Kasnije ove sedmice","this_weekend":"Ovog vikenda","next_week":"Sljedeće sedmice","two_weeks":"Dvije sedmice","next_month":"Sljedeći mjesec","two_months":"Dva mjeseca","three_months":"Tri mjeseca","four_months":"Četiri Mjeseca","six_months":"Šest mjeseci","one_year":"Godina","forever":"Zauvijek","pick_date_and_time":"Odaberi datum i vrijeme","set_based_on_last_post":"Zatvori koristeći za bazu zadnju objavu"},"publish_to_category":{"title":"Vremenski organizuj objavljivanje"},"temp_open":{"title":"Privremeno otvori"},"auto_reopen":{"title":"Automatski otvori temu"},"temp_close":{"title":"Privremeno zatvori"},"auto_close":{"title":"Automatski zatvori temu","label":"Sati do automatskog zatvaranja teme:","error":"Molim unesite ispravnu vrijednost.","based_on_last_post":"Ne zatvaraj temu sve dok zadnja objava u temi nije barem ovoliko stara."},"auto_delete":{"title":"Automatski izbriši temu"},"auto_bump":{"title":"Auto-Bump tema"},"reminder":{"title":"Podsjeti me"},"status_update_notice":{"auto_open":"Ova tema će biti automatski otvorena za %{timeLeft}","auto_close":"Ova tema će biti automatski zatvorena za %{timeLeft}","auto_publish_to_category":"Ova tema će biti objavljena u \u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e za %{timeLeft}.","auto_close_based_on_last_post":"Ova tema će se biti zatvorena %{duration} nakon zadnjeg odgovora.","auto_delete":"Ova tema će biti automatski izbrisana za %{timeLeft}","auto_bump":"Ova tema će biti automatski bumped %{timeLeft}.","auto_reminder":"Bit će te obaviješteni o ovoj temi za %{timeLeft}"},"auto_close_title":"Auto-Close Settings","auto_close_immediate":{"one":"Zanja objava u ovoj temi je već %{count} sat stara, stoga će tema biti odmah zatvorena.","few":"Zanja objava u ovoj temi je već sati %{count} stara, stoga će tema biti odmah zatvorena.","other":"Zanja objava u ovoj temi je već %{count} sati stara, stoga će tema biti odmah zatvorena."},"timeline":{"back":"Nazad","back_description":"Vratite se nazad na vašu zadnju nepročitanu objavu","replies_short":"%{current} / %{total}"},"progress":{"title":"progres teme","go_top":"vrh","go_bottom":"dno","go":"idi","jump_bottom":"skoči na zadnju objavu","jump_prompt":"skoči na...","jump_prompt_of":"od %{count} objava","jump_prompt_long":"Skoči na ...","jump_bottom_with_number":"skoči na post %{post_number}","jump_prompt_to_date":"do datuma","jump_prompt_or":"ili","total":"ukupan broj","current":"trenutni post"},"notifications":{"title":"izmijenite učestalost dobijanja obavještenja o ovoj temi","reasons":{"mailing_list_mode":"Imate uključenu mail listu, stoga će te biti obavještavani o odgovorima na ovu temu preko e-maila.","3_10":"Dobijat će te obavijesti jer pratite tag na ovoj temi.","3_6":"Dobijat ćete notifikacije zato što motrite ovu temu.","3_5":"Dobijat ćete notifikacije zato što motrite temu automatski.","3_2":"Dobijat ćete notifikacije zato što pratite ovu temu.","3_1":"Dobijat ćete notifikacije zato što ste kreirali ovu temu.","3":"Dobijat ćete notifikacije zato što motrite ovu temu.","2_8":"Vidjeti će te broj novih odgovora jer pratite ovu kategoriju.","2_4":"Vidjeti će te broj novih odgovora jer ste objavili odgovor na ovu temu.","2_2":"Vidjeti će te broj novih odgovora jer pratite ovu temu.","2":"Vidjeti će te broj novih odgovora jer ste \u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003ečitali ovu temu\u003c/a\u003e.","1_2":"Dobiti ćete notifikaciju kada neko spomene tvoje @name ili odgovori na tvoj post.","1":"Dobiti ćete notifikaciju kada neko spomene tvoje @name ili odgovori na tvoj post.","0_7":"Ignorišete sve notifikacije u ovoj kategoriji.","0_2":"Ignorišete sve notifikacije u ovoj temi.","0":"Ignorišete sve notifikacije u ovoj temi."},"watching_pm":{"title":"Motrenje","description":"Bit ćete obavješteni o svakom novom odgovoru u ovoj poruci, te će biti prikazan broj novih odgovora."},"watching":{"title":"Motrenje","description":"Bit će te obavješteni o svakom novom odgovoru na ovu temu, te će biti prikazan broj novih odgovora."},"tracking_pm":{"title":"Praćenje","description":"Broj novih odgovora će biti prikazan za ovu poruku. Bit će te obavješteni ukoliko neko pomene vaše @ime ili vam odgovori na poruku."},"tracking":{"title":"Praćenje","description":"Broj novih odgovora će biti prikazan za ovu temu. Bit će te obavješteni ukoliko neko pomene vaše @ime ili vam odgovori na temu."},"regular":{"title":"Regularan","description":"Dobiti ćete notifikaciju kada neko spomene tvoje @name ili odgovori na tvoj post."},"regular_pm":{"title":"Regularan","description":"Dobiti ćete notifikaciju kada neko spomene tvoje @name ili odgovori na tvoj post."},"muted_pm":{"title":"Mutirano","description":"You will never be notified of anything about this private message."},"muted":{"title":"Mutirano","description":"Nećete biti nikad obavješteni o bilo čemu sa ove teme, i neće biti prikazana u Novije"}},"actions":{"title":"Akcije","recover":"Un-Delete Topic","delete":"Delete Topic","open":"Open Topic","close":"Close Topic","multi_select":"Select Posts","timed_update":"Postavi trajanje teme....","pin":"Pin Topic","unpin":"Un-Pin Topic","unarchive":"Unarchive Topic","archive":"Archive Topic","invisible":"Make Unlisted","visible":"Make Listed","reset_read":"Reset Read Data","make_public":"Napiši temu javno","make_private":"Napravi personalnu poruku","reset_bump_date":"Resetuj datum bumpa"},"feature":{"pin":"Prikači temu","unpin":"Otkači temu","pin_globally":"Okači temu globalno","make_banner":"Banner tema","remove_banner":"Odstrani Banner temu"},"reply":{"title":"Odgovori","help":"započni odgovor na ovu temu"},"clear_pin":{"title":"Clear pin","help":"Clear the pinned status of this topic so it no longer appears at the top of your topic list"},"share":{"title":"Sheruj","extended_title":"Dijeli link","help":"podjeli link do ove teme"},"print":{"title":"Print","help":"Otvori printersku verziju ove teme"},"flag_topic":{"title":"Prijava","help":"anonimno prijavi ovu temu ili pošalji privatnu notifikaciju","success_message":"Uspješno ste prijavili ovu temu."},"make_public":{"title":"Pretvori u javnu temu","choose_category":"Odaberite kategoriju za javnu temu:"},"feature_topic":{"title":"Istakni ovu temu.","pin":"Postavi ovu temu da se pojavljuje na vrhu {{categoryLink}} kategorije sve dok","confirm_pin":"Već imate {{count}} okačenih tema. Previše okačenih tema može praviti teret za nove i anonimne korisnike. Da li ste sigurni da želite okačiti još jednu temu u ovoj kategoriji?","unpin":"Uklonite ovu temu sa vrha {{categoryLink}} kategorije.","unpin_until":"Uklonite ovu temu sa vrha {{categoryLink}} kategorije ili sačekajte do \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Korisnici mogu sami individualno za sebe odkloniti okačku sa teme.","pin_validation":"Potreban je datum kako bi okačili ovu temu.","not_pinned":"Nema okačenih tema u {{categoryLink}}.","already_pinned":{"one":"Tema trenutno zakačena u {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","few":"Teme trenutno zakačene u {{categoryLink}}: {{count}}","other":"Tema trenutno zakačenih u {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Postavi ovu temu da se prikazuje na vrhu svih lista tema sve do","confirm_pin_globally":"Već imate {{count}} globalno okačene teme. Previše okačenih tema mogu praviti teret za nove i anonimne korisnike. Da li ste sigurni da želite okačiti još jednu temu u ovoj kategoriji?","unpin_globally":"Uklonite ovu temu sa vrha svih lista tema.","unpin_globally_until":"Odklonite ovu temu sa vrha svih lista tema ili sačekajte do \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Korisnici mogu sami individualno za sebe ukloniti okačku sa teme.","not_pinned_globally":"Nema tema okačenih globalno.","already_pinned_globally":{"one":"Tema trenutno zakačena globalno: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","few":"Teme trenutno zakačene globalno: \u003cstrong class='badge badge-notification unread'\u003e{{count}} \u003c/strong\u003e","other":"Tema trenutno zakačeno globalno: \u003cstrong class='badge badge-notification unread'\u003e {{count}} \u003c/strong\u003e"},"make_banner":"Postavi ovu temu kao banner koji se pojavljuje na vrhu svih stranica.","remove_banner":"Uklonite banner koji se pojavljuje u vrhu svih stranica.","banner_note":"Korisnici mogu odkloniti banner tako što će ga zatvoriti. U svakom momentu samo jedna tema može biti postavljena za banner.","no_banner_exists":"Nema banner tema.","banner_exists":"Trenutno \u003cstrong class='badge badge-notification unread'\u003epostoji\u003c/strong\u003e banner tema."},"inviting":"Inviting...","automatically_add_to_groups":"Ova pozivnica uključuje također i pristup ka sljedećim grupama:","invite_private":{"title":"Invite to Private Message","email_or_username":"Invitee's Email or Username","email_or_username_placeholder":"email address or username","action":"Invite","success":"We've invited that user to participate in this private message.","success_group":"Pozvali ste čitavu tu grupu da učestvuje u raspavi u ovoj poruci.","error":"Sorry, there was an error inviting that user.","group_name":"group name"},"controls":"Kontrole teme","invite_reply":{"title":"Pozivnica","username_placeholder":"korisničko ime","action":"Email pozivnica","help":"pošalji pozivnicu svojim prijateljima tako da i oni mogu odgovoriti na ovu temu. Bey registracije.","to_forum":"We'll send a brief email allowing your friend to immediately join by clicking a link, no login required.","sso_enabled":"Unesite korisničko ime osobe koju želite da pozovete u ovu temu.","to_topic_blank":"Unesite korisničko ime ili e-mail adresu osobe koju želite da pozovete u ovu temu.","to_topic_email":"Unijeli ste e-mail adresu. Poslat ćemo e-mailom pozivnicu koja će omogućiti vašem prijatelju da odmah odgovori na ovu temu.","to_topic_username":"Unijeli ste korisničko ime. Na isto ćemo poslati obavještenje sa linkom pozivnice na ovu temu.","to_username":"Unesite korisničko ime osobe koju želite pozvati. Poslati ćemo obavještenje sa linkom pozivnice na ovu temu.","email_placeholder":"name@example.com","success_email":"Poslali smo e-mailom pozivnicu ka \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Obavjestiti ćemo vas kada pozivnica bude iskorištena. Provjerite tab pozivnica na vašoj profilnoj stranici kako bi ste upratili sve vaše pozivnice.","success_username":"Pozvali smo tog korisnika da prisustvuje u ovoj temi.","error":"Sorry, we couldn't invite that person. Perhaps they are already a user?","success_existing_email":"Korisnik sa emailom \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e već postoji. Pozvali smo tog korisnika da se pridruži u raspravi na ovu temu."},"login_reply":"Uloguj se da odgovoriš","filters":{"n_posts":{"one":"%{count} objava","few":"{{count}} objave","other":"{{count}} objava"},"cancel":"Show all posts in this topic again."},"move_to":{"title":"Idi kod","action":"idi kod","error":"Došlo je do greške prilikom premještanja postova."},"split_topic":{"title":"Move to New Topic","action":"move to new topic","topic_name":"Novi naslov teme","radio_label":"Nova tema","error":"There was an error moving posts to the new topic.","instructions":{"one":"Kreirati će te novu temu i popuniti je sa objavom koju ste označili.","few":"Kreirati će te novu temu i popuniti je sa \u003cb\u003e{{count}}\u003c/b\u003e objave koje ste označili.","other":"Kreirati će te novu temu i popuniti je sa \u003cb\u003e{{count}}\u003c/b\u003e objava koje ste označili."}},"merge_topic":{"title":"Move to Existing Topic","action":"move to existing topic","error":"There was an error moving posts into that topic.","radio_label":"Postojeća tema","instructions":{"one":"Molimo da odaberete temu u koju će te pomjeriti tu objavu.","few":"Molimo da odaberete temu u koju će te pomjeriti \u003cb\u003e{{count}}\u003c/b\u003e objave.","other":"Molimo da odaberete temu u koju će te pomjeriti \u003cb\u003e{{count}}\u003c/b\u003e objava."}},"move_to_new_message":{"title":"Premjesti u novu poruku","action":"pređite na novu poruku","message_title":"Novi Naslov Poruke","radio_label":"Nova poruka","participants":"Učesnici","instructions":{"one":"Namjeravate kreirati novu poruku i popuniti je odabranim postom.","few":"\u003cb\u003eNameravate\u003c/b\u003e da kreirate novu poruku i popunite je sa \u003cb\u003e{{count}} postavkama\u003c/b\u003e koje ste izabrali.","other":"\u003cb\u003eNameravate\u003c/b\u003e da kreirate novu poruku i popunite je sa \u003cb\u003e{{count}} postavkama\u003c/b\u003e koje ste izabrali."}},"move_to_existing_message":{"title":"Premjesti u postojeću poruku","action":"premjestite se na postojeću poruku","radio_label":"Existing Message","participants":"Učesnici","instructions":{"one":"Odaberite poruku u koju želite premjestiti taj post.","few":"Molimo odaberite poruku u koju želite premjestiti postove \u003cb\u003e{{count}}\u003c/b\u003e .","other":"Molimo odaberite poruku u koju želite premjestiti postove \u003cb\u003e{{count}}\u003c/b\u003e ."}},"merge_posts":{"title":"Spoji izabrane postove","action":"spoji izabrane postove","error":"Desila se greška prilikom spajanja označenih objava."},"change_owner":{"title":"Change Owner","action":"change ownership","error":"There was an error changing the ownership of the posts.","placeholder":"username of new owner","instructions":{"one":"Molimo odaberite novog vlasnika za post od \u003cb\u003e@ {{old_user}}\u003c/b\u003e","few":"Molimo odaberite novog vlasnika za {{count}} postove od \u003cb\u003e@ {{old_user}}\u003c/b\u003e","other":"Molimo odaberite novog vlasnika za {{count}} postove od \u003cb\u003e@ {{old_user}}\u003c/b\u003e"}},"change_timestamp":{"title":"Promijeni vremensku zabilješku...","action":"izmijeni vrijeme","invalid_timestamp":"Vrijeme ne može biti u budućnosti.","error":"Došlo je do greške prilikom izmjene vremena teme.","instructions":"Molimo da odaberete novu vremensku zabilješku teme. Objave u temi će biti ažurirane kako bi imale istu vremensku razliku."},"multi_select":{"select":"select","selected":"selected ({{count}})","select_post":{"label":"označi","title":"Dodaj objavu u označeno"},"selected_post":{"label":"označeno","title":"Klikni kako bi odstranio objavu iz označenog"},"select_replies":{"label":"označi +odgovore","title":"Odaberi objavu i sve njene odgovore"},"select_below":{"label":"označi +ispod","title":"Odaberi objavu i sve ispod nje"},"delete":"delete selected","cancel":"cancel selecting","select_all":"select all","deselect_all":"deselect all","description":{"one":"Označili ste \u003cb\u003e%{count}\u003c/b\u003e objavu.","few":"Označili ste \u003cb\u003e{{count}}\u003c/b\u003eobjave.","other":"Označili ste \u003cb\u003e{{count}}\u003c/b\u003e objava."}},"deleted_by_author":{"one":"(tema povučena od strane autora, automatski će biti obrisana u %{count} satu osim ako nije označena)","few":"(tema povučena od strane autora, automatski će biti obrisana u %{count} sati osim ako nije označena)","other":"(tema povučena od strane autora, automatski će biti obrisana u %{count} sati osim ako nije označena)"}},"post":{"quote_reply":"Citat","edit_reason":"Razlog: ","post_number":"post {{number}}","ignored":"Ignorisani sadržaj","wiki_last_edited_on":"wiki zanji put izmijenjen","last_edited_on":"post last edited on","reply_as_new_topic":"Odgovori kroz novu povezanu Temu","reply_as_new_private_message":"Odgovori kao nova poruka istim primaocima","continue_discussion":"Nastavak diskusije od teme {{postLink}}:","follow_quote":"idi na citiran post","show_full":"Pogledaj Cijeli Post","show_hidden":"Prikaz zanemarenog sadržaja.","deleted_by_author":{"one":"(objava povučena od strane autora, bit će automatski izbrisana za %{count} sat ukoliko u međuvremenu na nju nije stavljena opomena)","few":"(objava povučena od strane autora, bit će automatski izbrisana za %{count} sata ukoliko u međuvremenu na nju nije stavljena opomena)","other":"(objava povučena od strane autora, bit će automatski izbrisana za %{count} sati ukoliko u međuvremenu na nju nije stavljena prijava)"},"collapse":"spusti","expand_collapse":"digni/spusti","locked":"administrator je zaključao ovu objavu za nove izmjene","gap":{"one":"pogledaj %{count} skriven odgovor","few":"pogledaj {{count}} skrivena odgovora","other":"pogledaj {{count}} skrivenih odgovora"},"notice":{"new_user":"Ovo je prvi put da je {{user}} objavio - pozdravimo ih u našoj zajednici!","returning_user":"Prošlo je dosta vremena od kada smo vidjeli {{user}} - njihov zadnji post je bio {{time}}."},"unread":"Post je nepročitan","has_replies":{"one":"{{count}} Odgovor","few":"{{count}} Odgovora","other":"{{count}} Odgovora"},"has_likes_title":{"one":"%{count} osobi se sviđa ova objava","few":"{{count}} osoba se sviđa ova objava","other":"{{count}} osoba se sviđa ova objava"},"has_likes_title_only_you":"sviđa vam se ova objava","has_likes_title_you":{"one":"vama i još %{count} osobi vam se sviđa ova objava","few":"vama i još {{count}} ostale osobe vam se sviđa ova objava","other":"vama i još {{count}} ostalih osoba vam se sviđa ova objava"},"errors":{"create":"Sorry, there was an error creating your post. Please try again.","edit":"Sorry, there was an error editing your post. Please try again.","upload":"Sorry, there was an error uploading that file. Please try again.","file_too_large":"Nažalost, ta datoteka je prevelika (maksimalna veličina je {{max_size_kb}}kb). Zašto ne biste prenijeli vašu veliku datoteku na uslugu dijeljenja u oblaku, a zatim zalijepili vezu?","too_many_uploads":"Sorry, you can only upload one file at a time.","too_many_dragged_and_dropped_files":"Nažalost, možete postaviti samo datoteke {{max}} odjednom.","upload_not_authorized":"Nažalost, fajl koji pokušavate da učitate nije dozvoljen za učitavanje (dozvoljene ekstenzije su: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Sorry, new users can not upload images.","attachment_upload_not_allowed_for_new_user":"Sorry, new users can not upload attachments.","attachment_download_requires_login":"Sorry, you need to be logged in to download attachments."},"abandon_edit":{"no_value":"Ne, sačuvaj","no_save_draft":"Ne, spasi sastav"},"abandon":{"confirm":"Da li ste sigurni da želite otkazati vaš post?","no_value":"Ne, sačuvaj","no_save_draft":"Ne,spasi skicu","yes_value":"Da, otkaži"},"via_email":"this post arrived via email","via_auto_generated_email":"ova objava je došla preko automatski generisanog email-a","whisper":"ova objava je privatni šapat za moderatore ","wiki":{"about":"ova objava je wiki"},"archetypes":{"save":"Save Options"},"few_likes_left":"Hvala što dijelite ljubav i pažnju! Imate još par puta da podijelite sviđanja za danas.","controls":{"reply":"počni da sastavljaš odgovor na ovaj post","like":"lajkuj ovaj post","has_liked":"lajkovali ste ovaj post","undo_like":"otkaži lajk","edit":"izmjeni ovaj post","edit_action":"Izmijeni","edit_anonymous":"Sorry, but you need to be logged in to edit this post.","flag":"anonimno prijavi ovaj post ili pošalji privatnu notifikaciju","delete":"obriši ovaj post","undelete":"povrati obrisan post","share":"podijeli link do ovog posta","more":"Još","delete_replies":{"confirm":"Da li želite također da obrišete i odgovore na ovu objavu?","direct_replies":{"one":"Da, i %{count} direktni odgovor","few":"Da, i {{count}} direktna odgovora","other":"Da, i {{count}} direktnih odgovora"},"all_replies":{"one":"Da, i %{count} odgovor","few":"Da, i sva {{count}} odgovora","other":"Da, i svih {{count}} odgovora"},"just_the_post":"Ne, samo ovu objavu"},"admin":"post admin actions","wiki":"Make Wiki","unwiki":"Remove Wiki","convert_to_moderator":"Add Staff Color","revert_to_regular":"Remove Staff Color","rebake":"Rebuild HTML","unhide":"Unhide","change_owner":"Izmijeni vlasništvo","grant_badge":"Dodijeli bedž","lock_post":"Zaključaj objavu","lock_post_description":"spriječi objavljivača ove objave da izmijeni objavu","unlock_post":"Odključaj objavu","unlock_post_description":"dozvoli objavljivaču da izmijeni ovu objavu","delete_topic_disallowed_modal":"Nemate dozvolu za brisanje ove teme. Ako zaista želite da bude obrisan, pošaljite kaznu za pažnju moderatora zajedno s obrazloženjem.","delete_topic_disallowed":"nemate dozvolu za brisanje ove teme","delete_topic":"delete topic","add_post_notice":"Dodaj obaveštenje o osoblju","remove_post_notice":"Ukloni obavijest osoblja","remove_timer":"ukloni tajmer"},"actions":{"flag":"Prijava","defer_flags":{"one":"Ignoriši prijavu","few":"Ignoriši prijave","other":"Ignoriši prijave"},"undo":{"off_topic":"Otkaži prijavu","spam":"Otkaži prijavu","inappropriate":"Otkaži prijavu","bookmark":"Otkaži bookmark","like":"Otkaži lajk"},"people":{"off_topic":"prijava iskakanja iz okvira teme (off-topic)","spam":"prijava spama","inappropriate":"prijava neprimjerenog","notify_moderators":"moderatori obavješteni","notify_user":"poruka poslata","bookmark":"ovo zabilježio","like_capped":{"one":"i {{count}} drugim se svidelo ovo","few":"i {{count}} drugima se ovo svidelo","other":"i {{count}} drugima se ovo svidelo"}},"by_you":{"off_topic":"Prijavili ste ovo kao iskakanje iz okvira teme (off-topic)","spam":"Prijavili ste ovo kao spam","inappropriate":"Prijavili ste ovo kao neprimjereno","notify_moderators":"Prijavili ste ovo za korigovanje od strane moderatora","notify_user":"You sent a private message to this user","bookmark":"You bookmarked this post","like":"Lajkovao si ovo"}},"delete":{"confirm":{"one":"Jeste li sigurni da želite izbrisati taj post?","few":"Jeste li sigurni da želite izbrisati one postove {{count}}?","other":"Jeste li sigurni da želite izbrisati one postove {{count}}?"}},"merge":{"confirm":{"one":"Jeste li sigurni da želite spojiti te postove?","few":"Jeste li sigurni da želite spojiti te postove {{count}}?","other":"Jeste li sigurni da želite spojiti te postove {{count}}?"}},"revisions":{"controls":{"first":"First revision","previous":"Previous revision","next":"Next revision","last":"Last revision","hide":"Hide revision","show":"Show revision","revert":"Vratite se na ovu reviziju","edit_wiki":"Promjni Wiki","edit_post":"Promjeni Post","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}} \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Show the rendered output with additions and removals inline","button":"HTML"},"side_by_side":{"title":"Show the rendered output diffs side-by-side","button":"HTML"},"side_by_side_markdown":{"title":"Show the raw source diffs side-by-side","button":"Raw"}}},"raw_email":{"displays":{"raw":{"title":"Prikaži sirov e-mail","button":"Trulo"},"text_part":{"title":"Prikažite tekstualni dio e-pošte","button":"Poruka"},"html_part":{"title":"Prikažite html dio e-maila","button":"HTML"}}},"bookmarks":{"created":"Kreiran","name":"Ime"}},"category":{"can":"can\u0026hellip; ","none":"(no category)","all":"Sve kategorije","choose":"kategorij i pomoć","edit":"Izmijeni","edit_dialog_title":"promjeni: %{categoryName}","view":"View Topics in Category","general":"General","settings":"Settings","topic_template":"Tematski predložak","tags":"Oznake","tags_allowed_tags":"Ograničite ove oznake na ovu kategoriju:","tags_allowed_tag_groups":"Ograničite ove grupe oznaka na ovu kategoriju:","tags_placeholder":"(Opcionalno) lista dozvoljenih oznaka","tag_groups_placeholder":"(Opcionalno) lista dozvoljenih grupa oznaka","manage_tag_groups_link":"Upravljajte grupama oznaka ovdje.","allow_global_tags_label":"Takođe dozvolite druge oznake","topic_featured_link_allowed":"Omogućite istaknute veze u ovoj kategoriji","delete":"Delete Category","create":"Create Category","create_long":"Napravite novu kategoriju","save":"Save Category","slug":"Kategorija Slug","slug_placeholder":"(Opcionalno) isprekidane riječi za url","creation_error":"There has been an error during the creation of the category.","save_error":"There was an error saving the category.","name":"Category Name","description":"Description","topic":"category topic","logo":"Category Logo Image","background_image":"Category Background Image","badge_colors":"Badge colors","background_color":"Background color","foreground_color":"Foreground color","name_placeholder":"One or two words maximum","color_placeholder":"Any web color","delete_confirm":"Are you sure you want to delete this category?","delete_error":"There was an error deleting the category.","list":"List Categories","no_description":"Please add a description for this category.","change_in_category_topic":"Edit Description","already_used":"This color has been used by another category","security":"Security","special_warning":"Upozorenje: Ova kategorija je pre-seeded kategorija i sigurnosne postavke se ne mogu uređivati. Ako ne želite koristiti ovu kategoriju, izbrišite je umjesto da je prenamijenite.","images":"Images","email_in":"Custom incoming email address:","email_in_allow_strangers":"Accept emails from anonymous users with no accounts","email_in_disabled":"Posting new topics via email is disabled in the Site Settings. To enable posting new topics via email, ","email_in_disabled_click":"enable the \"email in\" setting.","mailinglist_mirror":"Kategorija odražava mailing listu","show_subcategory_list":"Prikaži listu podkategorija iznad tema u ovoj kategoriji.","subcategory_num_featured_topics":"Broj istaknutih tema na stranici roditeljske kategorije:","all_topics_wiki":"Podrazumevano postavite nove teme","subcategory_list_style":"Stil podkategorije:","sort_order":"Lista tema Sortiraj po:","default_view":"Podrazumevana lista tema:","default_top_period":"Obićni Top Period:","allow_badges_label":"Allow badges to be awarded in this category","edit_permissions":"Edit Permissions","reviewable_by_group":"Pored osoblja, postovi i zastave u ovoj kategoriji mogu se pregledati i putem:","review_group_name":"group name","require_topic_approval":"Potrebno je odobrenje moderatora za sve nove teme","require_reply_approval":"Potrebno je odobrenje moderatora za sve nove odgovore","this_year":"this year","position":"Pozicija na stranici kategorije:","default_position":"Default Position","position_disabled":"Categories will be displayed in order of activity. To control the order of categories in lists, ","position_disabled_click":"enable the \"fixed category positions\" setting.","minimum_required_tags":"Minimalni broj oznaka potrebnih za temu:","parent":"Parent Category","num_auto_bump_daily":"Broj otvorenih tema koje se svakodnevno automatski izbijaju:","navigate_to_first_post_after_read":"Idite na prvi post nakon što se teme pročitaju","notifications":{"watching":{"title":"Motrenje","description":"Automatski ćete gledati sve teme u ovim kategorijama. Bićete obaviješteni o svakom novom postu u svakoj temi, a broj novih odgovora će biti prikazan."},"watching_first_post":{"title":"Pratiti prve objave","description":"Bićete obaviješteni o novim temama u ovoj kategoriji, ali ne i odgovorima na teme."},"tracking":{"title":"Praćenje"},"regular":{"title":"Regularan","description":"Dobiti ćete notifikaciju kada neko spomene tvoje @name ili odgovori na tvoj post."},"muted":{"title":"Mutirano"}},"search_priority":{"label":"Prioritet pretraživanja","options":{"normal":"Normalno","ignore":"Zanemari","very_low":"Jako nisko","low":"Nisko","high":"Visoko","very_high":"Jako Visoko"}},"sort_options":{"default":"obićno","likes":"Sviđanja","op_likes":"Likovi Orginalnog Posta","views":"Pregleda","posts":"Objava","activity":"Aktivnosti","posters":"Posteri","category":"Kategorija","created":"Kreiran"},"sort_ascending":"Diže se","sort_descending":"Spužđšta se","subcategory_list_styles":{"rows":"Redovi","rows_with_featured_topics":"Redovi sa istaknutim temama","boxes":"Kutije","boxes_with_featured_topics":"Kutije sa istaknutim temama"},"settings_sections":{"general":"General","moderation":"Moderacija","appearance":"Izgled","email":"Email"}},"flagging":{"title":"Zašto prijavljujete ovaj post?","action":"Prijavi objavu","take_action":"Poduzmi Akciju","notify_action":"Privatna Poruka","official_warning":"Oficonalno upozorenje","delete_spammer":"Obriši Spamera","yes_delete_spammer":"Da, Obriši Spamera","ip_address_missing":"(N/A)","hidden_email_address":"(hidden)","submit_tooltip":"Predaj privatnu prijavu","take_action_tooltip":"Dosegni prag prijava radije odmah, nego čekati da se nakupi više prijava","cant":"Nažalost, trenutno ne možete prijaviti ovu objavu","notify_staff":"Obavestite osoblje privatno","formatted_name":{"off_topic":"To je isključeno","inappropriate":"Neprikladno je","spam":"To je Spam"},"custom_placeholder_notify_user":"Zašto ovaj post nalaže da kontaktirate korisnika privatno. Budite detaljni, pristojni i korektni.","custom_placeholder_notify_moderators":"Zašto ovaj post zaslužuje pažnju moderatora. Navedite vaš razlog po mogućnosti ostavite link ako je nužno.","custom_message":{"at_least":{"one":"unesite bar %{count} znak","few":"unesite najmanje {{count}} znakova","other":"unesite najmanje {{count}} znakova"},"more":{"one":"%{count} to go ...","few":"{{count}} to go ... \\ t","other":"{{count}}preostalo..."},"left":{"one":"%{count} preostalo","few":"{{count}} preostalo","other":"{{count}} preostalo"}}},"flagging_topic":{"title":"Zašto privatno opominjete ovu temu?","action":"Prijavi temu","notify_action":"Privatna poruka"},"topic_map":{"title":"Pregled Teme","participants_title":"Ljudi koji često šalju","links_title":"Popularni linkovi","links_shown":"prikaži više linkova ...","clicks":{"one":"%{count} click","few":"%{count} klika","other":"%{count} klika"}},"post_links":{"about":"proširite više linkova za ovaj post","title":{"one":"%{count} more","few":"%{count} more","other":"%{count} više"}},"topic_statuses":{"warning":{"help":"Ovo je zvanično upozorenje."},"bookmarked":{"help":"Obeležili ste ovu temu"},"locked":{"help":"Ova tema je zatvorena; zvanično ne prima nove postove"},"archived":{"help":"Ova tema je arhivirana; zaleđena je i ne može biti promjenjena"},"locked_and_archived":{"help":"Ova tema je zatvorena i arhivirana; zvanično ne prima nove postove"},"unpinned":{"title":"Unpinned","help":"This topic is unpinned; it will display in default order"},"pinned_globally":{"title":"Zakačena Globalno","help":"Ova tema je postavljena na globalnom nivou; ona će se prikazati na vrhu najnovije i njene kategorije"},"pinned":{"title":"Zakačena","help":"Ova tema je zakačena; biće na vrhu svoje kategorije"},"unlisted":{"help":"Ovu temu sajt ne lista među najnovijim temama. Neće biti prisutna ni među listama tema unutar kategorija. Jedini način da se dođe do ove teme je direktan link"},"personal_message":{"title":"Ova tema je lična poruka","help":"Ova tema je lična poruka"}},"posts":"Odgovori","posts_long":"postoji {{number}} odgovora u ovoj temi","original_post":"Originalni Odgovor","views":"Pregleda","views_lowercase":{"one":"pogled","few":"pregledi","other":"pregledi"},"replies":"Odgovora","views_long":{"one":"ova tema je pregledana %{count} time","few":"Ova tema je pregledana {{number}} puta","other":"Ova tema je pregledana {{number}} puta"},"activity":"Aktivnost","likes":"Lajkovi","likes_lowercase":{"one":"like","few":"likes","other":"likajkovi"},"likes_long":"postoji {{number}} lajkova u ovoj temi","users":"Korisnici","users_lowercase":{"one":"korisnik","few":"korisnika","other":"korisnici"},"category_title":"Kategorija","history":"Istorija","changed_by":"od {{author}}","raw_email":{"title":"Dolazna email","not_available":"Nije dostupno!"},"categories_list":"Lista Kategorija","filters":{"with_topics":"%{filter} teme","with_category":"%{filter} %{category} teme","latest":{"title":"Zadnje","title_with_count":{"one":"Najnoviji (%{count})","few":"Najnoviji ({{count}}) \\ t","other":"Najnoviji ({{count}}) \\ t"},"help":"teme sa nedavnim postovima"},"read":{"title":"Pročitane","help":"teme koje ste pročitali, zadnje pročitane na vrhu."},"categories":{"title":"Kategorije","title_in":"Kategorija - {{categoryName}}","help":"sve teme grupisane po kategoriji"},"unread":{"title":"Nepročitanih","title_with_count":{"one":"Nepročitano (%{count})","few":"Nepročitano ({{count}})","other":"Nepročitano ({{count}})"},"help":"teme koje trenutno pratite i motrite sa nepročitanim postovima","lower_title_with_count":{"one":"%{count} unread","few":"{{count}} unread","other":"{{count}} unread"}},"new":{"lower_title_with_count":{"one":"%{count} novi","few":"{{count}} nova","other":"{{count}} novih"},"lower_title":"nova","title":"Novo","title_with_count":{"one":"Novo (%{count})","few":"Novo ({{count}})","other":"Novo ({{count}})"},"help":"teme kreirane u zadnjih nekoliko dana"},"posted":{"title":"Moji Odgovori","help":"teme u kojima imate postove"},"bookmarks":{"title":"Zabilješke","help":"teme koje ste označili"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (%{count})","few":"{{categoryName}} ({{count}})","other":"{{categoryName}} ({{count}})"},"help":"zadnje teme u {{categoryName}} kategoriji"},"top":{"title":"Popularne","help":"najaktivnije teme u zadnjih godinu, mjesec, sedmicu i dan","all":{"title":"Sve vrijeme"},"yearly":{"title":"Popularne Godišnje"},"quarterly":{"title":"Kvartalno"},"monthly":{"title":"Popularne Mjesečno"},"weekly":{"title":"Popularne Sedmično"},"daily":{"title":"Popularne Dnevno"},"all_time":"Sve vrijeme","this_year":"Godina","this_quarter":"Četvrtina","this_month":"Mjesec","this_week":"Nedelja","today":"Danas","other_periods":"see top"}},"permission_types":{"full":"Kreiraj / Odgovori / Vidi","create_post":"Odgovori / Vidi","readonly":"Vidi"},"lightbox":{"download":"skini","previous":"Prošlo (Tipka sa strelicom lijevo)","next":"Sljedeće (tipka sa strelicom udesno)","counter":"%curr% od %total%","close":"Zatvori (Esc)","content_load_error":"\u003ca href=\"%url%\"\u003eSadržaj\u003c/a\u003e nije moguće učitati.","image_load_error":"\u003ca href=\"%url%\"\u003eSlika\u003c/a\u003e se ne može učitati."},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":", \\ T","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1} ili %{shortcut2}","shortcut_delimiter_slash":"%{shortcut1} / %{shortcut2}","title":"Kratice tipkovnice","jump_to":{"title":"Skoči na","home":"%{shortcut} Home (Najnovije)","latest":"%{shortcut} Najnovije","new":"%{shortcut} Nove Teme","unread":"%{shortcut} Nepročitane","categories":"%{shortcut} Kategorije","top":"%{shortcut} Popularne","bookmarks":"%{shortcut} Oznaka","profile":"%{shortcut} Profil","messages":"%{shortcut} Porka","drafts":"%{shortcut}Skica"},"navigation":{"title":"Navigacija","jump":"%{shortcut} Idi na post #","back":"%{shortcut} Nazad","up_down":"%{shortcut} Move selection \u0026uarr; \u0026darr;","open":"%{shortcut} Open selected topic","next_prev":"%{shortcut} Next/previous section","go_to_unread_post":"%{shortcut} Idi na prvu nepročitanu poruku"},"application":{"title":"Aplikacija","create":"%{shortcut} Započni novu temu","notifications":"%{shortcut} Otvori notifikacije","hamburger_menu":"%{shortcut} Otvori padajući meni","user_profile_menu":"%{shortcut} Otvori meni korisnika","show_incoming_updated_topics":"%{shortcut} Pročitaj promjenje teme","search":"%{shortcut} Traži","help":"%{shortcut} Otvori pomoć za tastaturu","dismiss_new_posts":"%{shortcut} Dismiss New/Posts","dismiss_topics":"%{shortcut} Dismiss Topics","log_out":"%{shortcut} Odjavi se"},"composing":{"title":"komppziranje","return":"%{shortcut} Povratak kompozitoru","fullscreen":"%{shortcut} Kompozitor preko cijelog ekrana"},"actions":{"title":"Akcije","bookmark_topic":"%{shortcut} Namjesti oznaći temu","pin_unpin_topic":"%{shortcut} Pin / Unpin temu","share_topic":"%{shortcut} Sheruj temu","share_post":"%{shortcut} Sheruj post","reply_as_new_topic":"%{shortcut} Odgovori kroz novu temu","reply_topic":"%{shortcut} Odgovori na Temu","reply_post":"%{shortcut} Odgovori na post","quote_post":"%{shortcut} Citiraj odgovor","like":"%{shortcut} Lajkuj post","flag":"%{shortcut} Prijavi objavu","bookmark":"%{shortcut} Bookmark post","edit":"%{shortcut} Izmjeni post","delete":"%{shortcut} Obriši post","mark_muted":"%{shortcut} Mutiraj temu","mark_regular":"%{shortcut} Regularna tema","mark_tracking":"%{shortcut} Prati temu","mark_watching":"%{shortcut} Motri temu","print":"%{shortcut} Odštampaj temu","defer":"%{shortcut} Defer temu","topic_admin_actions":"%{shortcut} Otvori opcije administriranja teme"}},"badges":{"earned_n_times":{"one":"Zaradio / la sam ovu oznaku %{count} time","few":"Zaradili ste ovu oznaku %{count} puta","other":"Zaradili ste ovu oznaku %{count} puta"},"granted_on":"Odobren %{date}","others_count":"Ostale sa ovom značkom (%{count}) \\ t","title":"Bedž","allow_title":"Ovu značku možete koristiti kao naslov","multiple_grant":"To možete zaraditi više puta","badge_count":{"one":"%{count} Badge","few":"%{count} Značke","other":"%{count} Značkih"},"more_badges":{"one":"+ %{count} Više","few":"+ %{count} Više","other":"+ %{count} Više"},"granted":{"one":"%{count} odobreno","few":"%{count} odobreno","other":"%{count} odobreno"},"select_badge_for_title":"Izaveri bedž za svoj naslov","none":"(ništa)","successfully_granted":"Uspješno dodijeljen %{badge} za %{username}","badge_grouping":{"getting_started":{"name":"Da započnete"},"community":{"name":"Zajednica"},"trust_level":{"name":"Nivo povjerenja"},"other":{"name":"Ostalo"},"posting":{"name":"Objavljivanje"}}},"tagging":{"all_tags":"Sve oznake","other_tags":"Druge oznake","selector_all_tags":"sve oznake","selector_no_tags":"bez oznaka","changed":"oznake  promijenjene:","tags":"Oznake","choose_for_topic":"izborne oznake","info":"Informacija","default_info":"Ovaj oznaka nije predodređena ni za jednu kategoriju i nema sinonime.","category_restricted":"Ova oznaka je predodređena za kategorije na koje nemate pravo pristupa.","synonyms":"Sinonimi","synonyms_description":"U slučaju da se sljedeće oznake koriste, iste će biti zamijenjene sa \u003cb\u003e%{base_tag_name}\u003c/b\u003e.","tag_groups_info":{"one":"Ovaj tag pripada grupi \"{{tag_groups}}\".","few":"Ovaj tag pripada sljedećim grupama: {{tag_groups}}.","other":"Ova oznaka pripada sljedećim grupama: {{tag_groups}}."},"category_restrictions":{"one":"Moguće je koristiti samo u sljedećoj kategoriji:","few":"Moguće je koristiti samo u sljedećim kategorijama:","other":"Moguće je koristiti samo u sljedećim kategorijama:"},"edit_synonyms":"Uredi sinonime","add_synonyms_label":"Dodaj sinonime:","add_synonyms":"Dodaj","add_synonyms_explanation":{"one":"Svaka lokacija koja trenutno koristi ovu oznaku bit će zamjenjena sa \u003cb\u003e%{tag_name}\u003c/b\u003e. Jeste li sigurni da želite izvršiti tu promjenu?","few":"Svaka lokacija koja trenutno koristi ove oznake bit će zamjenjena sa \u003cb\u003e%{tag_name}\u003c/b\u003e. Jeste li sigurni da želite izvršiti tu promjenu?","other":"Svaka lokacija koja trenutno koristi ove oznake bit će zamjenjena sa \u003cb\u003e%{tag_name}\u003c/b\u003e. Jeste li sigurni da želite izvršiti tu promjenu?"},"add_synonyms_failed":"Sljedeće oznake nije moguće dodati kao sinonime: \u003cb\u003e%{tag_names}\u003c/b\u003e. Osigurajte prvo da nemaju već postojeće sinonime i da nisu sinonimi neke druge oznake.","remove_synonym":"Odstrani sinonim","delete_synonym_confirm":"Jeste li sigurni da želite izbrisati sinonim \"%{tag_name}\"?","delete_tag":"Izbriši oznaku","delete_confirm":{"one":"Jeste li sigurni da želite izbrisati ovu oznaku i ukloniti je iz teme %{count} kojoj je dodijeljen?","few":"Jeste li sigurni da želite izbrisati ovu oznaku i ukloniti je iz tema {{count}} kojima je dodijeljena?","other":"Jeste li sigurni da želite izbrisati ovu oznaku i ukloniti je iz tema {{count}} kojima je dodijeljena?"},"delete_confirm_no_topics":"Jeste li sigurni da želite izbrisati ovu oznaku?","delete_confirm_synonyms":{"one":"Pripadajući sinonim će također biti obrisan.","few":"Pripadajućih {{count}} sinonima će također biti obrisano.","other":"Pripadajućih {{count}} sinonima će također biti obrisano."},"rename_tag":"Promjeni ime Oznake","rename_instructions":"Odaberite novo ime za oznaku:","sort_by":"Sortiraj po:","sort_by_count":"brojenje","sort_by_name":"ime","manage_groups":"Upravljanje grupama oznaka","manage_groups_description":"Definišite grupe za organizovanje oznaka","upload":"Prenesi oznake","upload_description":"Otpremite csv datoteku da biste grupisali oznake","upload_instructions":"Jedan po liniji, opciono sa oznakom grupe u formatu 'tag_name, tag_group'.","upload_successful":"Oznake koje su uspješno prenesene","delete_unused_confirmation":{"one":"%{count} tag će biti izbrisan: %{tags}","few":"Oznake %{count} će biti izbrisane: %{tags}","other":"%{count} oznaki će biti izbrisane: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} i %{count} više","few":"%{tags} i %{count} više","other":"%{tags} i %{count} više"},"delete_unused":"Brisanje neiskorištenih oznaka","delete_unused_description":"Izbrišite sve oznake koje nisu vezane za teme ili lične poruke","cancel_delete_unused":"Otkaži","filters":{"without_category":"%{filter} %{tag} topics","with_category":"%{filter} %{tag} teme ove kategorije %{category}","untagged_without_category":"%{filter} ne oznaćene tema","untagged_with_category":"%{filter} neoznaćeni tema ove kategorije %{category}"},"notifications":{"watching":{"title":"Motrenje","description":"Automatski ćete gledati sve teme s ovom oznakom. Bićete obaviješteni o svim novim postovima i temama, plus broj nepročitanih i novih postova će se pojaviti pored teme."},"watching_first_post":{"title":"Pratiti prve objave","description":"Bićete obaviješteni o novim temama u ovoj oznaci, ali ne io odgovorima na teme."},"tracking":{"title":"Praćenje","description":"Automatski ćete pratiti sve teme s ovom oznakom. Broj nepročitanih i novih postova će se pojaviti pored teme."},"regular":{"title":"Regularan","description":"You will be notified only if someone mentions your @name or replies to your post."},"muted":{"title":"Utišan","description":"Nećete bit obavješteni bilo čime o ovoj temi sa ovom oznakom, i neće se pojavljivati na tabularu nepročitanih tema."}},"groups":{"title":"Označite grupe","about":"Dodajte oznake grupama da biste ih lakše upravljali.","new":"Nova grupa ","tags_label":"Oznake u ovoj grupi:","tags_placeholder":"Oznake","parent_tag_label":"Roditeljska oznaka:","parent_tag_placeholder":"Opcionalno","parent_tag_description":"Oznake iz ove grupe ne mogu se koristiti ako roditeljska oznaka nije prisutna.","one_per_topic_label":"Ograničite jednu oznaku po temi iz ove grupe","new_name":"Nova Grupa Oznaka","name_placeholder":"Ime grupe oznaka","save":"Sačuvaj","delete":"Delete","confirm_delete":"Jeste li sigurni da želite izbrisati ovu grupu oznaka?","everyone_can_use":"Oznake mogu koristiti svi","usable_only_by_staff":"Oznake su vidljive svima, ali samo osoblje ih može koristiti","visible_only_to_staff":"Oznake su vidljive samo osoblju"},"topics":{"none":{"unread":"Nemate više nepročitanih tema.","new":"Nemate više novih tema.","read":"Niste pročitali nijednu temu.","posted":"Niste odgovorili ni na jednu temu.","latest":"Nema najnovijih tema.","bookmarks":"Nemate još bookmark-iranih tema.","top":"Nema više popularnih tema."},"bottom":{"latest":"Nema više novih tema.","posted":"There are no more posted topics.","read":"Nema više pročitanih tema.","new":"Nema više novih tema.","unread":"Nema više nepročitanih tema.","top":"Nema više popularnih tema.","bookmarks":"Nema više bookmark-ovanih tema."}}},"invite":{"custom_message":"Učinite vašu pozivnicu malo osobnijom tako što ćete napisati \u003ca href\u003eprilagođenu poruku\u003c/a\u003e .","custom_message_placeholder":"Unesite prilagođenu poruku","custom_message_template_forum":"Hej, trebalo bi da se pridružiš ovom forumu!","custom_message_template_topic":"Hej, mislio sam da ćete uživati u ovoj temi!"},"forced_anonymous":"Zbog ekstremnog opterećenja, ovo se privremeno prikazuje svima, jer bi ga odjavio korisnik.","safe_mode":{"enabled":"Bezbedan režim je omogućen, da biste izašli iz bezbednog režima, zatvorite ovaj prozor pregledača"},"poll":{"voters":{"one":"glasač","few":"glasača","other":"glasača"},"total_votes":{"one":"ukupan glas","few":"ukupno glasova","other":"ukupno glasova"},"average_rating":"Prosječna ocjena: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Glasanje je \u003cstrong\u003ejavno\u003c/strong\u003e."},"results":{"groups":{"title":"Morate biti pripadnik %{groups} kako bi ste mogli glasati u ovoj anketi."},"vote":{"title":"Rezultati će biti prikazani pritiskom na\u003cstrong\u003eglasaj\u003c/strong\u003e."},"closed":{"title":"Rezultati će biti prikazani onda kada glasanje bude \u003cstrong\u003ezavršeno\u003c/strong\u003e."},"staff":{"title":"Rezultati su prikazani samo \u003cstrong\u003euredništvu i admin\u003c/strong\u003e korisnicima."}},"multiple":{"help":{"at_least_min_options":{"one":"Odaberi barem \u003cstrong\u003e%{count}\u003c/strong\u003e opciju","few":"Odaberi barem \u003cstrong\u003e%{count}\u003c/strong\u003e opcije","other":"Odaberi barem \u003cstrong\u003e%{count}\u003c/strong\u003e opcija"},"up_to_max_options":{"one":"Odaberi do \u003cstrong\u003e%{count}\u003c/strong\u003e opciju","few":"Odaberi do \u003cstrong\u003e%{count}\u003c/strong\u003e opcije","other":"Odaberi do \u003cstrong\u003e%{count}\u003c/strong\u003e opcija"},"x_options":{"one":"Odaberi \u003cstrong\u003e%{count}\u003c/strong\u003e opciju","few":"Odaberi \u003cstrong\u003e%{count}\u003c/strong\u003e opcije","other":"Odaberi \u003cstrong\u003e%{count}\u003c/strong\u003e opcija"},"between_min_and_max_options":"Odaberi između \u003cstrong\u003e%{min}\u003c/strong\u003e i \u003cstrong\u003e%{max}\u003c/strong\u003e opcija"}},"cast-votes":{"title":"ukupno glasova","label":"Glasaj"},"show-results":{"title":"Prikaži rezultate ankete","label":"Prikaži rezultate"},"hide-results":{"title":"Nazad na glasove","label":"Prikaži glasanje"},"group-results":{"title":"Grupiraj glasove po polju korisnika","label":"Prikaži raspodjelu"},"ungroup-results":{"title":"Kombiniraj sve glasove","label":"Sakrij raspodjelu"},"export-results":{"title":"Izvezi rezultate ankete (Export)","label":"Izvoz"},"open":{"title":"Otvori anketu","label":"Otvori","confirm":"Da li ste sigurni da želite da otvorite ovu anketu?"},"close":{"title":"Zatvori anketu","label":"Zatvori","confirm":"Da li ste sigurni da želite da zatvorite ovu anketu?"},"automatic_close":{"closes_in":"Završava za \u003cstrong\u003e%{timeLeft}\u003c/strong\u003e.","age":"Završeno \u003cstrong\u003e%{age}\u003c/strong\u003e"},"error_while_toggling_status":"Izvinjavamo se, pojavio se problem u prebacivanju statutusa ove ankete","error_while_casting_votes":"Izvinjavamo se, pojavila se greška prikazivanja vaših glasova","error_while_fetching_voters":"Izvinjavamo se, pojavila se greška pri prikazivanju glasača","error_while_exporting_results":"Izvinjavamo se, došlo je do greške izvoza rezultata vaše ankete.","ui_builder":{"title":"Izgradi anketu","insert":"Umetni anketu","help":{"options_count":"Unesite barem jednu opciju","invalid_values":"Minimalna vrijednost mora biti manja od maksimalne.","min_step_value":"Minimalna vrijednost razmaka je 1"},"poll_type":{"label":"Tip","regular":"Jedan izbor","multiple":"Višestruki izbor","number":"Rejting broja"},"poll_result":{"label":"Rezultati","always":"Uvjek vidljivo","vote":"Prilikom glasanja","closed":"Kada se završi","staff":"Samo za urednike i admine"},"poll_groups":{"label":"Dozvoljene grupe"},"poll_chart_type":{"label":"Tip chart grafikona"},"poll_config":{"max":"Maksimalno","min":"Minimalno","step":"Korak"},"poll_public":{"label":"Pokaži ko je glasao"},"poll_options":{"label":"Upišite jednu opciju ankete po liniji"},"automatic_close":{"label":"Automatski zatvori anketu"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"Odpočni tutorial za nove korisnike za sve novoregistrovane korisnike","welcome_message":"Pošalji svim novim korisnicima poruku dobrodošlice sa smijernicama za korištenje"}},"discourse_local_dates":{"relative_dates":{"today":"Danas%{time}","tomorrow":"Sutra %{time}","yesterday":"Jučer %{time}","countdown":{"passed":"datum je prošao"}},"title":"Unesi datum / vrijeme","create":{"form":{"insert":"Unesi","advanced_mode":"Napredni način","simple_mode":"Jednostavan način","format_description":"Format koji je korišten kako bi prikazali vrijeme korisniku. Koristite \"\\T\\Z\" kako bi korisniku prikazali vremensku zonu riječima (Europe/Paris)","timezones_title":"Vremenske zone za prikazati","timezones_description":"Vremenske zone će biti korištene kako bi prikazale datume u pregledu i u nazad.","recurring_title":"Vraćanje","recurring_description":"Definiši ponavljanje eventa. Možete također menuelno izmijeniti opcije ponavljanja generisanih od strane foruma i koristiti jedan od sljedećih ključeva: godine, kvartali, mjeseci, sedmice, dani, sati, minute, sekunde, milisekunde.","recurring_none":"Bez ponavljanja","invalid_date":"Neispravan datum, osigurajte da su datum i vrijeme tačni","date_title":"Datum","time_title":"Vrijeme","format_title":"Format datuma","timezone":"Vremenska zona","until":"Sve do...","recurring":{"every_day":"Svaki dan","every_week":"Svake sedmice","every_two_weeks":"Svake dvije sedmice","every_month":"Svaki mjesec","every_two_months":"Svaka dva mjeseca","every_three_months":"Svaka tri mjeseca","every_six_months":"Svakih šest mjeseci","every_year":"Svake godine"}}}},"details":{"title":"Sakrij detalje"},"presence":{"replying":"odgovara","editing":"ispravlja","replying_to_topic":{"one":"piše","few":"piše","other":"pišu"}},"voting":{"vote_title":"Glasaj","voting_closed_title":"Zatvoreno"},"adplugin":{"advertisement_label":"OGLAS"},"docker":{"upgrade":"Vaša Discourse instalacije je zastarijela.","perform_upgrade":"Klikni ovjde za nadogradnju."}}},"zh_CN":{"js":{"dates":{"time_short_day":"ddd, HH:mm","long_no_year":"M[月]D[日] HH:mm"},"bookmarked":{"help":{"unbookmark_with_reminder":"点击以移除该主题上的所有收藏和提醒。你在该主题中设定了一个于%{reminder_at}的提醒。"}},"bookmarks":{"created_with_reminder":"你已经收藏该帖并且设定了一个于%{date}的提醒","created_with_at_desktop_reminder":"你所收藏的此帖将会在你下次使用桌面设备时被提醒。","delete":"删除收藏","confirm_delete":"你确定要删除该收藏吗？你所设置的提醒也会被一并删除。","invalid_custom_datetime":"你所提供的日期和时间无效，请重试。","list_permission_denied":"你没有权限查看该用户的收藏。","reminders":{"next_business_day":"下一个工作日","start_of_next_business_week":"下周一","last_custom":"最近","none":"无需提醒","today_with_time":"今天%{time}","tomorrow_with_time":"明天%{time}","at_time":"于%{date_time}","existing_reminder":"你为该收藏所设定的提醒将被发出"}},"directory":{"last_updated":"最近更新："},"groups":{"requests":{"handle":"处理成员请求"}},"user":{"use_current_timezone":"使用现在的时区","staff_counters":{"rejected_posts":"被驳回的帖子"},"second_factor":{"totp":{"name_and_code_required_error":"你必须提供你的身份验证器应用的名称和代码。"},"security_key":{"name_required_error":"你必须提供安全密钥的名称。"}},"change_avatar":{"gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e，基于","gravatar_title":"在{{gravatarName}}网站修改你的头像","gravatar_failed":"我们无法找到此电子邮件的{{gravatarName}}。","refresh_gravatar_title":"刷新你的{{gravatarName}}"},"invite_code":{"title":"邀请码","instructions":"账户注册需要邀请码"}},"modal":{"dismiss_error":"忽略错误"},"logs_error_rate_notice":{},"login":{"security_key_support_missing_error":"您当前的设备或浏览器不支持使用安全密钥。请使用其他方法。","discord":{"name":"Discord","title":"with Discord"},"second_factor_toggle":{"totp":"改用身份验证APP","backup_code":"使用备份码"}},"emoji_set":{"emoji_one":"JoyPixels （曾用名EmojiOne）"},"composer":{"link_url_placeholder":"粘贴 URL 或键入以搜索主题","composer_actions":{"reply_as_new_topic":{"confirm":"您保存了新的主题草稿，如果您创建链接主题该草稿将被覆盖。"}}},"notifications":{"tooltip":{"high_priority":{"other":"%{count}个未读的高优先级通知"}},"membership_request_accepted":"接受来自“{{group_name}}”的邀请","membership_request_consolidated":"{{count}}个加入“{{group_name}}”群组的请求","titles":{"bookmark_reminder":"收藏提醒","bookmark_reminder_with_name":"收藏提醒 - %{name}","membership_request_consolidated":"新的成员申请"}},"search":{"context":{"tag":"搜索＃{{tag}}标签"},"advanced":{"filters":{"created":"我创建的"},"statuses":{"public":"是公开的"}}},"view_all":"查看全部","topic":{"feature_on_profile":{"help":"添加此主题的链接到你的用户卡片和资料中。","title":"精选到个人资料"},"remove_from_profile":{"warning":"你的个人资料中已存在精选主题。如果继续，此主题会替换存在的主题。","help":"在你的个人资料中移除指向该主题的链接","title":"从个人资料中移除"},"unread_indicator":"还没有成员读过此主题的最新帖子。","topic_status_update":{"num_of_days":"天数"},"auto_delete_replies":{"title":"自动删除回复"},"status_update_notice":{"auto_delete_replies":"此主题的回复会在%{duration}后自动删除。"},"publish_page":{"publish":"出版","description":"当一个主题被出版为一个页面时，其链接是共享的，并且会以自定义的样式显示。","slug":"Slug","publish_url":"你的页面已出版于：","topic_published":"你的主题已出版于：","preview_url":"你的页面将出版于：","invalid_slug":"抱歉，您不能出版此页面。","unpublish":"取消出版","unpublished":"你的页面已经取消出版并且不再可用。","publishing_settings":"出版设置"},"change_owner":{"instructions_without_old_user":{"other":"请为此{{count}}个帖子选择一个新的拥有者。"}}},"post":{"abandon_edit":{"confirm":"您确定要放弃所做的更改吗？","yes_value":"是的，忽略编辑"},"controls":{"read_indicator":"阅读了帖子的用户"},"actions":{"people":{"like":{"other":"点赞"},"read":{"other":"看过"},"read_capped":{"other":"还有{{count}}个其他用户看过"}}},"bookmarks":{"create":"创建收藏夹","edit":"编辑收藏","name_placeholder":"这个收藏是做什么用的？","set_reminder":"提醒我","actions":{"delete_bookmark":{"name":"删除收藏","description":"从你的个人资料中删除收藏并停止所有有关该收藏的提醒"},"edit_bookmark":{"name":"编辑收藏","description":"编辑收藏名称或修改提醒的日期和时间"}}}},"category":{"tags_tab_description":"上面所指定的标签和标签组仅在此分类以及其它也指定了它们的分类中可用。它们将无法在其它分类中使用。","tag_group_selector_placeholder":"（可选）标签组","required_tag_group_description":"要求新主题包含标签组中的标签：","min_tags_from_required_group_label":"标签数量：","required_tag_group_label":"标签组：","uncategorized_security_warning":"这是个特殊的分类。如果不知道应该话题属于哪个分类，那么请使用这个分类。这个分类没有安全设置。","uncategorized_general_warning":"这个分类是特殊的。它用作未选择分类的新主题的默认分类。如果你想要避免此行为并强制选择分类，\u003ca href=\"%{settingLink}\"\u003e请在此处禁用该设置\u003c/a\u003e。如果你要修改其名称或描述，请转到\u003ca href=\"%{customizeLink}\"\u003e自定义/文本内容\u003c/a\u003e。","pending_permission_change_alert":"你还没有添加%{group}到此分类；点击此按钮添加。","num_featured_topics":"分类页面上显示的主题数量：","notifications":{"tracking":{"description":"你将自动跟踪这些分类中的所有主题。如果有人@你或回复你，将通知你，还将显示新回复的数量。"},"muted":{"description":"在这些分类里面，你将不会收到新主题任何通知，它们也不会出现在“最新”主题列表。 "}},"sort_options":{"votes":"投票"}},"flagging":{},"filters":{"votes":{"title":"推荐","help":"选票最多的主题"}},"browser_update":"抱歉，\u003ca href=\"http://www.discourse.com/faq/#browser\"\u003e你的浏览器版本太低，无法正常访问该站点\u003c/a\u003e。请\u003ca href=\"http://browsehappy.com\"\u003e升级你的浏览器\u003c/a\u003e。","keyboard_shortcuts_help":{"shortcut_delimiter_space":"%{shortcut1}%{shortcut2}","bookmarks":{"title":"收藏","enter":"%{shortcut} 保存并关闭","later_today":"%{shortcut} 今天晚些时候","later_this_week":"%{shortcut} 本周的晚些时候","tomorrow":"%{shortcut} 明天","next_week":"%{shortcut} 下周","next_month":"%{shortcut} 下个月","next_business_week":"%{shortcut} 下周开始","next_business_day":"%{shortcut} 下个工作日","custom":"%{shortcut} 自定义日期和时间","none":"%{shortcut} 没有提醒","delete":"%{shortcut} 删除收藏"},"search_menu":{"title":"搜索菜单","prev_next":"%{shortcut}上下移动所选内容","insert_url":"%{shortcut}将选定内容插入到打开的编辑器"}},"voting":{"title":"投票","reached_limit":"你没有选票了，先删除一张已选票！","list_votes":"显示你的投票","votes_nav_help":"选票最多的主题","voted":"你在该主题中已经投过票了","allow_topic_voting":"允许用户在此分类中为主帖点推荐","vote_title_plural":"推荐","voted_title":"已投票","voting_limit":"次数限制","votes_left":{"other":"你还有 {{count}} 张选票，查看\u003ca href='{{path}}'\u003e你的投票\u003c/a\u003e。"},"votes":{"other":"{{count}} 票"},"anonymous_button":{"other":"投票"},"remove_vote":"移除投票"}}},"en":{"js":{"user":{"change_password":{"emoji":"lock emoji"}},"local_time":"Local Time","email_login":{"emoji":"lock emoji"},"invites":{"emoji":"envelope emoji"},"notifications":{"tooltip":{"high_priority":{"one":"%{count} unread high priority notification"}}},"topic":{"publish_page":{"title":"Page Publishing"},"change_owner":{"instructions_without_old_user":{"one":"Please choose a new owner for the post"}}},"post":{"controls":{"publish_page":"Page Publishing"},"actions":{"people":{"like":{"one":"liked this"},"read":{"one":"read this"},"read_capped":{"one":"and {{count}} other read this"}}}},"discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"voting":{"votes_left":{"one":"You have {{count}} vote left, see \u003ca href='{{path}}'\u003eyour votes\u003c/a\u003e."},"votes":{"one":"{{count}} vote"},"anonymous_button":{"one":"Vote"}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'bs_BA';
//! moment.js

;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.moment = factory()
}(this, (function () { 'use strict';

    var hookCallback;

    function hooks () {
        return hookCallback.apply(null, arguments);
    }

    // This is done to register the method called with moment()
    // without creating circular dependencies.
    function setHookCallback (callback) {
        hookCallback = callback;
    }

    function isArray(input) {
        return input instanceof Array || Object.prototype.toString.call(input) === '[object Array]';
    }

    function isObject(input) {
        // IE8 will treat undefined and null as object if it wasn't for
        // input != null
        return input != null && Object.prototype.toString.call(input) === '[object Object]';
    }

    function isObjectEmpty(obj) {
        if (Object.getOwnPropertyNames) {
            return (Object.getOwnPropertyNames(obj).length === 0);
        } else {
            var k;
            for (k in obj) {
                if (obj.hasOwnProperty(k)) {
                    return false;
                }
            }
            return true;
        }
    }

    function isUndefined(input) {
        return input === void 0;
    }

    function isNumber(input) {
        return typeof input === 'number' || Object.prototype.toString.call(input) === '[object Number]';
    }

    function isDate(input) {
        return input instanceof Date || Object.prototype.toString.call(input) === '[object Date]';
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function hasOwnProp(a, b) {
        return Object.prototype.hasOwnProperty.call(a, b);
    }

    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function createUTC (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, true).utc();
    }

    function defaultParsingFlags() {
        // We need to deep clone this object.
        return {
            empty           : false,
            unusedTokens    : [],
            unusedInput     : [],
            overflow        : -2,
            charsLeftOver   : 0,
            nullInput       : false,
            invalidMonth    : null,
            invalidFormat   : false,
            userInvalidated : false,
            iso             : false,
            parsedDateParts : [],
            meridiem        : null,
            rfc2822         : false,
            weekdayMismatch : false
        };
    }

    function getParsingFlags(m) {
        if (m._pf == null) {
            m._pf = defaultParsingFlags();
        }
        return m._pf;
    }

    var some;
    if (Array.prototype.some) {
        some = Array.prototype.some;
    } else {
        some = function (fun) {
            var t = Object(this);
            var len = t.length >>> 0;

            for (var i = 0; i < len; i++) {
                if (i in t && fun.call(this, t[i], i, t)) {
                    return true;
                }
            }

            return false;
        };
    }

    function isValid(m) {
        if (m._isValid == null) {
            var flags = getParsingFlags(m);
            var parsedParts = some.call(flags.parsedDateParts, function (i) {
                return i != null;
            });
            var isNowValid = !isNaN(m._d.getTime()) &&
                flags.overflow < 0 &&
                !flags.empty &&
                !flags.invalidMonth &&
                !flags.invalidWeekday &&
                !flags.weekdayMismatch &&
                !flags.nullInput &&
                !flags.invalidFormat &&
                !flags.userInvalidated &&
                (!flags.meridiem || (flags.meridiem && parsedParts));

            if (m._strict) {
                isNowValid = isNowValid &&
                    flags.charsLeftOver === 0 &&
                    flags.unusedTokens.length === 0 &&
                    flags.bigHour === undefined;
            }

            if (Object.isFrozen == null || !Object.isFrozen(m)) {
                m._isValid = isNowValid;
            }
            else {
                return isNowValid;
            }
        }
        return m._isValid;
    }

    function createInvalid (flags) {
        var m = createUTC(NaN);
        if (flags != null) {
            extend(getParsingFlags(m), flags);
        }
        else {
            getParsingFlags(m).userInvalidated = true;
        }

        return m;
    }

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    var momentProperties = hooks.momentProperties = [];

    function copyConfig(to, from) {
        var i, prop, val;

        if (!isUndefined(from._isAMomentObject)) {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (!isUndefined(from._i)) {
            to._i = from._i;
        }
        if (!isUndefined(from._f)) {
            to._f = from._f;
        }
        if (!isUndefined(from._l)) {
            to._l = from._l;
        }
        if (!isUndefined(from._strict)) {
            to._strict = from._strict;
        }
        if (!isUndefined(from._tzm)) {
            to._tzm = from._tzm;
        }
        if (!isUndefined(from._isUTC)) {
            to._isUTC = from._isUTC;
        }
        if (!isUndefined(from._offset)) {
            to._offset = from._offset;
        }
        if (!isUndefined(from._pf)) {
            to._pf = getParsingFlags(from);
        }
        if (!isUndefined(from._locale)) {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i = 0; i < momentProperties.length; i++) {
                prop = momentProperties[i];
                val = from[prop];
                if (!isUndefined(val)) {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    var updateInProgress = false;

    // Moment prototype object
    function Moment(config) {
        copyConfig(this, config);
        this._d = new Date(config._d != null ? config._d.getTime() : NaN);
        if (!this.isValid()) {
            this._d = new Date(NaN);
        }
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            hooks.updateOffset(this);
            updateInProgress = false;
        }
    }

    function isMoment (obj) {
        return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
    }

    function absFloor (number) {
        if (number < 0) {
            // -0 -> 0
            return Math.ceil(number) || 0;
        } else {
            return Math.floor(number);
        }
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            value = absFloor(coercedNumber);
        }

        return value;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function warn(msg) {
        if (hooks.suppressDeprecationWarnings === false &&
                (typeof console !==  'undefined') && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;

        return extend(function () {
            if (hooks.deprecationHandler != null) {
                hooks.deprecationHandler(null, msg);
            }
            if (firstTime) {
                var args = [];
                var arg;
                for (var i = 0; i < arguments.length; i++) {
                    arg = '';
                    if (typeof arguments[i] === 'object') {
                        arg += '\n[' + i + '] ';
                        for (var key in arguments[0]) {
                            arg += key + ': ' + arguments[0][key] + ', ';
                        }
                        arg = arg.slice(0, -2); // Remove trailing comma and space
                    } else {
                        arg = arguments[i];
                    }
                    args.push(arg);
                }
                warn(msg + '\nArguments: ' + Array.prototype.slice.call(args).join('') + '\n' + (new Error()).stack);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    var deprecations = {};

    function deprecateSimple(name, msg) {
        if (hooks.deprecationHandler != null) {
            hooks.deprecationHandler(name, msg);
        }
        if (!deprecations[name]) {
            warn(msg);
            deprecations[name] = true;
        }
    }

    hooks.suppressDeprecationWarnings = false;
    hooks.deprecationHandler = null;

    function isFunction(input) {
        return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
    }

    function set (config) {
        var prop, i;
        for (i in config) {
            prop = config[i];
            if (isFunction(prop)) {
                this[i] = prop;
            } else {
                this['_' + i] = prop;
            }
        }
        this._config = config;
        // Lenient ordinal parsing accepts just a number in addition to
        // number + (possibly) stuff coming from _dayOfMonthOrdinalParse.
        // TODO: Remove "ordinalParse" fallback in next major release.
        this._dayOfMonthOrdinalParseLenient = new RegExp(
            (this._dayOfMonthOrdinalParse.source || this._ordinalParse.source) +
                '|' + (/\d{1,2}/).source);
    }

    function mergeConfigs(parentConfig, childConfig) {
        var res = extend({}, parentConfig), prop;
        for (prop in childConfig) {
            if (hasOwnProp(childConfig, prop)) {
                if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                    res[prop] = {};
                    extend(res[prop], parentConfig[prop]);
                    extend(res[prop], childConfig[prop]);
                } else if (childConfig[prop] != null) {
                    res[prop] = childConfig[prop];
                } else {
                    delete res[prop];
                }
            }
        }
        for (prop in parentConfig) {
            if (hasOwnProp(parentConfig, prop) &&
                    !hasOwnProp(childConfig, prop) &&
                    isObject(parentConfig[prop])) {
                // make sure changes to properties don't modify parent config
                res[prop] = extend({}, res[prop]);
            }
        }
        return res;
    }

    function Locale(config) {
        if (config != null) {
            this.set(config);
        }
    }

    var keys;

    if (Object.keys) {
        keys = Object.keys;
    } else {
        keys = function (obj) {
            var i, res = [];
            for (i in obj) {
                if (hasOwnProp(obj, i)) {
                    res.push(i);
                }
            }
            return res;
        };
    }

    var defaultCalendar = {
        sameDay : '[Today at] LT',
        nextDay : '[Tomorrow at] LT',
        nextWeek : 'dddd [at] LT',
        lastDay : '[Yesterday at] LT',
        lastWeek : '[Last] dddd [at] LT',
        sameElse : 'L'
    };

    function calendar (key, mom, now) {
        var output = this._calendar[key] || this._calendar['sameElse'];
        return isFunction(output) ? output.call(mom, now) : output;
    }

    var defaultLongDateFormat = {
        LTS  : 'h:mm:ss A',
        LT   : 'h:mm A',
        L    : 'MM/DD/YYYY',
        LL   : 'MMMM D, YYYY',
        LLL  : 'MMMM D, YYYY h:mm A',
        LLLL : 'dddd, MMMM D, YYYY h:mm A'
    };

    function longDateFormat (key) {
        var format = this._longDateFormat[key],
            formatUpper = this._longDateFormat[key.toUpperCase()];

        if (format || !formatUpper) {
            return format;
        }

        this._longDateFormat[key] = formatUpper.replace(/MMMM|MM|DD|dddd/g, function (val) {
            return val.slice(1);
        });

        return this._longDateFormat[key];
    }

    var defaultInvalidDate = 'Invalid date';

    function invalidDate () {
        return this._invalidDate;
    }

    var defaultOrdinal = '%d';
    var defaultDayOfMonthOrdinalParse = /\d{1,2}/;

    function ordinal (number) {
        return this._ordinal.replace('%d', number);
    }

    var defaultRelativeTime = {
        future : 'in %s',
        past   : '%s ago',
        s  : 'a few seconds',
        ss : '%d seconds',
        m  : 'a minute',
        mm : '%d minutes',
        h  : 'an hour',
        hh : '%d hours',
        d  : 'a day',
        dd : '%d days',
        M  : 'a month',
        MM : '%d months',
        y  : 'a year',
        yy : '%d years'
    };

    function relativeTime (number, withoutSuffix, string, isFuture) {
        var output = this._relativeTime[string];
        return (isFunction(output)) ?
            output(number, withoutSuffix, string, isFuture) :
            output.replace(/%d/i, number);
    }

    function pastFuture (diff, output) {
        var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
        return isFunction(format) ? format(output) : format.replace(/%s/i, output);
    }

    var aliases = {};

    function addUnitAlias (unit, shorthand) {
        var lowerCase = unit.toLowerCase();
        aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
    }

    function normalizeUnits(units) {
        return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    var priorities = {};

    function addUnitPriority(unit, priority) {
        priorities[unit] = priority;
    }

    function getPrioritizedUnits(unitsObj) {
        var units = [];
        for (var u in unitsObj) {
            units.push({unit: u, priority: priorities[u]});
        }
        units.sort(function (a, b) {
            return a.priority - b.priority;
        });
        return units;
    }

    function zeroFill(number, targetLength, forceSign) {
        var absNumber = '' + Math.abs(number),
            zerosToFill = targetLength - absNumber.length,
            sign = number >= 0;
        return (sign ? (forceSign ? '+' : '') : '-') +
            Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
    }

    var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

    var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

    var formatFunctions = {};

    var formatTokenFunctions = {};

    // token:    'M'
    // padded:   ['MM', 2]
    // ordinal:  'Mo'
    // callback: function () { this.month() + 1 }
    function addFormatToken (token, padded, ordinal, callback) {
        var func = callback;
        if (typeof callback === 'string') {
            func = function () {
                return this[callback]();
            };
        }
        if (token) {
            formatTokenFunctions[token] = func;
        }
        if (padded) {
            formatTokenFunctions[padded[0]] = function () {
                return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
            };
        }
        if (ordinal) {
            formatTokenFunctions[ordinal] = function () {
                return this.localeData().ordinal(func.apply(this, arguments), token);
            };
        }
    }

    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '', i;
            for (i = 0; i < length; i++) {
                output += isFunction(array[i]) ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());
        formatFunctions[format] = formatFunctions[format] || makeFormatFunction(format);

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }

    var match1         = /\d/;            //       0 - 9
    var match2         = /\d\d/;          //      00 - 99
    var match3         = /\d{3}/;         //     000 - 999
    var match4         = /\d{4}/;         //    0000 - 9999
    var match6         = /[+-]?\d{6}/;    // -999999 - 999999
    var match1to2      = /\d\d?/;         //       0 - 99
    var match3to4      = /\d\d\d\d?/;     //     999 - 9999
    var match5to6      = /\d\d\d\d\d\d?/; //   99999 - 999999
    var match1to3      = /\d{1,3}/;       //       0 - 999
    var match1to4      = /\d{1,4}/;       //       0 - 9999
    var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

    var matchUnsigned  = /\d+/;           //       0 - inf
    var matchSigned    = /[+-]?\d+/;      //    -inf - inf

    var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z
    var matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi; // +00 -00 +00:00 -00:00 +0000 -0000 or Z

    var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

    // any word (or two) characters or numbers including two/three word month in arabic.
    // includes scottish gaelic two word and hyphenated months
    var matchWord = /[0-9]{0,256}['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFF07\uFF10-\uFFEF]{1,256}|[\u0600-\u06FF\/]{1,256}(\s*?[\u0600-\u06FF]{1,256}){1,2}/i;

    var regexes = {};

    function addRegexToken (token, regex, strictRegex) {
        regexes[token] = isFunction(regex) ? regex : function (isStrict, localeData) {
            return (isStrict && strictRegex) ? strictRegex : regex;
        };
    }

    function getParseRegexForToken (token, config) {
        if (!hasOwnProp(regexes, token)) {
            return new RegExp(unescapeFormat(token));
        }

        return regexes[token](config._strict, config._locale);
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function unescapeFormat(s) {
        return regexEscape(s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        }));
    }

    function regexEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    var tokens = {};

    function addParseToken (token, callback) {
        var i, func = callback;
        if (typeof token === 'string') {
            token = [token];
        }
        if (isNumber(callback)) {
            func = function (input, array) {
                array[callback] = toInt(input);
            };
        }
        for (i = 0; i < token.length; i++) {
            tokens[token[i]] = func;
        }
    }

    function addWeekParseToken (token, callback) {
        addParseToken(token, function (input, array, config, token) {
            config._w = config._w || {};
            callback(input, config._w, config, token);
        });
    }

    function addTimeToArrayFromToken(token, input, config) {
        if (input != null && hasOwnProp(tokens, token)) {
            tokens[token](input, config._a, config, token);
        }
    }

    var YEAR = 0;
    var MONTH = 1;
    var DATE = 2;
    var HOUR = 3;
    var MINUTE = 4;
    var SECOND = 5;
    var MILLISECOND = 6;
    var WEEK = 7;
    var WEEKDAY = 8;

    // FORMATTING

    addFormatToken('Y', 0, 0, function () {
        var y = this.year();
        return y <= 9999 ? '' + y : '+' + y;
    });

    addFormatToken(0, ['YY', 2], 0, function () {
        return this.year() % 100;
    });

    addFormatToken(0, ['YYYY',   4],       0, 'year');
    addFormatToken(0, ['YYYYY',  5],       0, 'year');
    addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

    // ALIASES

    addUnitAlias('year', 'y');

    // PRIORITIES

    addUnitPriority('year', 1);

    // PARSING

    addRegexToken('Y',      matchSigned);
    addRegexToken('YY',     match1to2, match2);
    addRegexToken('YYYY',   match1to4, match4);
    addRegexToken('YYYYY',  match1to6, match6);
    addRegexToken('YYYYYY', match1to6, match6);

    addParseToken(['YYYYY', 'YYYYYY'], YEAR);
    addParseToken('YYYY', function (input, array) {
        array[YEAR] = input.length === 2 ? hooks.parseTwoDigitYear(input) : toInt(input);
    });
    addParseToken('YY', function (input, array) {
        array[YEAR] = hooks.parseTwoDigitYear(input);
    });
    addParseToken('Y', function (input, array) {
        array[YEAR] = parseInt(input, 10);
    });

    // HELPERS

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    // HOOKS

    hooks.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    // MOMENTS

    var getSetYear = makeGetSet('FullYear', true);

    function getIsLeapYear () {
        return isLeapYear(this.year());
    }

    function makeGetSet (unit, keepTime) {
        return function (value) {
            if (value != null) {
                set$1(this, unit, value);
                hooks.updateOffset(this, keepTime);
                return this;
            } else {
                return get(this, unit);
            }
        };
    }

    function get (mom, unit) {
        return mom.isValid() ?
            mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]() : NaN;
    }

    function set$1 (mom, unit, value) {
        if (mom.isValid() && !isNaN(value)) {
            if (unit === 'FullYear' && isLeapYear(mom.year()) && mom.month() === 1 && mom.date() === 29) {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value, mom.month(), daysInMonth(value, mom.month()));
            }
            else {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
            }
        }
    }

    // MOMENTS

    function stringGet (units) {
        units = normalizeUnits(units);
        if (isFunction(this[units])) {
            return this[units]();
        }
        return this;
    }


    function stringSet (units, value) {
        if (typeof units === 'object') {
            units = normalizeObjectUnits(units);
            var prioritized = getPrioritizedUnits(units);
            for (var i = 0; i < prioritized.length; i++) {
                this[prioritized[i].unit](units[prioritized[i].unit]);
            }
        } else {
            units = normalizeUnits(units);
            if (isFunction(this[units])) {
                return this[units](value);
            }
        }
        return this;
    }

    function mod(n, x) {
        return ((n % x) + x) % x;
    }

    var indexOf;

    if (Array.prototype.indexOf) {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function (o) {
            // I know
            var i;
            for (i = 0; i < this.length; ++i) {
                if (this[i] === o) {
                    return i;
                }
            }
            return -1;
        };
    }

    function daysInMonth(year, month) {
        if (isNaN(year) || isNaN(month)) {
            return NaN;
        }
        var modMonth = mod(month, 12);
        year += (month - modMonth) / 12;
        return modMonth === 1 ? (isLeapYear(year) ? 29 : 28) : (31 - modMonth % 7 % 2);
    }

    // FORMATTING

    addFormatToken('M', ['MM', 2], 'Mo', function () {
        return this.month() + 1;
    });

    addFormatToken('MMM', 0, 0, function (format) {
        return this.localeData().monthsShort(this, format);
    });

    addFormatToken('MMMM', 0, 0, function (format) {
        return this.localeData().months(this, format);
    });

    // ALIASES

    addUnitAlias('month', 'M');

    // PRIORITY

    addUnitPriority('month', 8);

    // PARSING

    addRegexToken('M',    match1to2);
    addRegexToken('MM',   match1to2, match2);
    addRegexToken('MMM',  function (isStrict, locale) {
        return locale.monthsShortRegex(isStrict);
    });
    addRegexToken('MMMM', function (isStrict, locale) {
        return locale.monthsRegex(isStrict);
    });

    addParseToken(['M', 'MM'], function (input, array) {
        array[MONTH] = toInt(input) - 1;
    });

    addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
        var month = config._locale.monthsParse(input, token, config._strict);
        // if we didn't find a month name, mark the date as invalid.
        if (month != null) {
            array[MONTH] = month;
        } else {
            getParsingFlags(config).invalidMonth = input;
        }
    });

    // LOCALES

    var MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s)+MMMM?/;
    var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
    function localeMonths (m, format) {
        if (!m) {
            return isArray(this._months) ? this._months :
                this._months['standalone'];
        }
        return isArray(this._months) ? this._months[m.month()] :
            this._months[(this._months.isFormat || MONTHS_IN_FORMAT).test(format) ? 'format' : 'standalone'][m.month()];
    }

    var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
    function localeMonthsShort (m, format) {
        if (!m) {
            return isArray(this._monthsShort) ? this._monthsShort :
                this._monthsShort['standalone'];
        }
        return isArray(this._monthsShort) ? this._monthsShort[m.month()] :
            this._monthsShort[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
    }

    function handleStrictParse(monthName, format, strict) {
        var i, ii, mom, llc = monthName.toLocaleLowerCase();
        if (!this._monthsParse) {
            // this is not used
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
            for (i = 0; i < 12; ++i) {
                mom = createUTC([2000, i]);
                this._shortMonthsParse[i] = this.monthsShort(mom, '').toLocaleLowerCase();
                this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeMonthsParse (monthName, format, strict) {
        var i, mom, regex;

        if (this._monthsParseExact) {
            return handleStrictParse.call(this, monthName, format, strict);
        }

        if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
        }

        // TODO: add sorting
        // Sorting makes sure if one month (or abbr) is a prefix of another
        // see sorting in computeMonthsParse
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            if (strict && !this._longMonthsParse[i]) {
                this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
            }
            if (!strict && !this._monthsParse[i]) {
                regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                return i;
            } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                return i;
            } else if (!strict && this._monthsParse[i].test(monthName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function setMonth (mom, value) {
        var dayOfMonth;

        if (!mom.isValid()) {
            // No op
            return mom;
        }

        if (typeof value === 'string') {
            if (/^\d+$/.test(value)) {
                value = toInt(value);
            } else {
                value = mom.localeData().monthsParse(value);
                // TODO: Another silent failure?
                if (!isNumber(value)) {
                    return mom;
                }
            }
        }

        dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function getSetMonth (value) {
        if (value != null) {
            setMonth(this, value);
            hooks.updateOffset(this, true);
            return this;
        } else {
            return get(this, 'Month');
        }
    }

    function getDaysInMonth () {
        return daysInMonth(this.year(), this.month());
    }

    var defaultMonthsShortRegex = matchWord;
    function monthsShortRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsShortStrictRegex;
            } else {
                return this._monthsShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsShortRegex')) {
                this._monthsShortRegex = defaultMonthsShortRegex;
            }
            return this._monthsShortStrictRegex && isStrict ?
                this._monthsShortStrictRegex : this._monthsShortRegex;
        }
    }

    var defaultMonthsRegex = matchWord;
    function monthsRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsStrictRegex;
            } else {
                return this._monthsRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsRegex')) {
                this._monthsRegex = defaultMonthsRegex;
            }
            return this._monthsStrictRegex && isStrict ?
                this._monthsStrictRegex : this._monthsRegex;
        }
    }

    function computeMonthsParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom;
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            shortPieces.push(this.monthsShort(mom, ''));
            longPieces.push(this.months(mom, ''));
            mixedPieces.push(this.months(mom, ''));
            mixedPieces.push(this.monthsShort(mom, ''));
        }
        // Sorting makes sure if one month (or abbr) is a prefix of another it
        // will match the longer piece.
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 12; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
        }
        for (i = 0; i < 24; i++) {
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._monthsShortRegex = this._monthsRegex;
        this._monthsStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._monthsShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
    }

    function createDate (y, m, d, h, M, s, ms) {
        // can't just apply() to create a date:
        // https://stackoverflow.com/q/181348
        var date;
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            date = new Date(y + 400, m, d, h, M, s, ms);
            if (isFinite(date.getFullYear())) {
                date.setFullYear(y);
            }
        } else {
            date = new Date(y, m, d, h, M, s, ms);
        }

        return date;
    }

    function createUTCDate (y) {
        var date;
        // the Date.UTC function remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            var args = Array.prototype.slice.call(arguments);
            // preserve leap years using a full 400 year cycle, then reset
            args[0] = y + 400;
            date = new Date(Date.UTC.apply(null, args));
            if (isFinite(date.getUTCFullYear())) {
                date.setUTCFullYear(y);
            }
        } else {
            date = new Date(Date.UTC.apply(null, arguments));
        }

        return date;
    }

    // start-of-first-week - start-of-year
    function firstWeekOffset(year, dow, doy) {
        var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
            fwd = 7 + dow - doy,
            // first-week day local weekday -- which local weekday is fwd
            fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

        return -fwdlw + fwd - 1;
    }

    // https://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
        var localWeekday = (7 + weekday - dow) % 7,
            weekOffset = firstWeekOffset(year, dow, doy),
            dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
            resYear, resDayOfYear;

        if (dayOfYear <= 0) {
            resYear = year - 1;
            resDayOfYear = daysInYear(resYear) + dayOfYear;
        } else if (dayOfYear > daysInYear(year)) {
            resYear = year + 1;
            resDayOfYear = dayOfYear - daysInYear(year);
        } else {
            resYear = year;
            resDayOfYear = dayOfYear;
        }

        return {
            year: resYear,
            dayOfYear: resDayOfYear
        };
    }

    function weekOfYear(mom, dow, doy) {
        var weekOffset = firstWeekOffset(mom.year(), dow, doy),
            week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1,
            resWeek, resYear;

        if (week < 1) {
            resYear = mom.year() - 1;
            resWeek = week + weeksInYear(resYear, dow, doy);
        } else if (week > weeksInYear(mom.year(), dow, doy)) {
            resWeek = week - weeksInYear(mom.year(), dow, doy);
            resYear = mom.year() + 1;
        } else {
            resYear = mom.year();
            resWeek = week;
        }

        return {
            week: resWeek,
            year: resYear
        };
    }

    function weeksInYear(year, dow, doy) {
        var weekOffset = firstWeekOffset(year, dow, doy),
            weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
        return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
    }

    // FORMATTING

    addFormatToken('w', ['ww', 2], 'wo', 'week');
    addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

    // ALIASES

    addUnitAlias('week', 'w');
    addUnitAlias('isoWeek', 'W');

    // PRIORITIES

    addUnitPriority('week', 5);
    addUnitPriority('isoWeek', 5);

    // PARSING

    addRegexToken('w',  match1to2);
    addRegexToken('ww', match1to2, match2);
    addRegexToken('W',  match1to2);
    addRegexToken('WW', match1to2, match2);

    addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
        week[token.substr(0, 1)] = toInt(input);
    });

    // HELPERS

    // LOCALES

    function localeWeek (mom) {
        return weekOfYear(mom, this._week.dow, this._week.doy).week;
    }

    var defaultLocaleWeek = {
        dow : 0, // Sunday is the first day of the week.
        doy : 6  // The week that contains Jan 6th is the first week of the year.
    };

    function localeFirstDayOfWeek () {
        return this._week.dow;
    }

    function localeFirstDayOfYear () {
        return this._week.doy;
    }

    // MOMENTS

    function getSetWeek (input) {
        var week = this.localeData().week(this);
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    function getSetISOWeek (input) {
        var week = weekOfYear(this, 1, 4).week;
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    // FORMATTING

    addFormatToken('d', 0, 'do', 'day');

    addFormatToken('dd', 0, 0, function (format) {
        return this.localeData().weekdaysMin(this, format);
    });

    addFormatToken('ddd', 0, 0, function (format) {
        return this.localeData().weekdaysShort(this, format);
    });

    addFormatToken('dddd', 0, 0, function (format) {
        return this.localeData().weekdays(this, format);
    });

    addFormatToken('e', 0, 0, 'weekday');
    addFormatToken('E', 0, 0, 'isoWeekday');

    // ALIASES

    addUnitAlias('day', 'd');
    addUnitAlias('weekday', 'e');
    addUnitAlias('isoWeekday', 'E');

    // PRIORITY
    addUnitPriority('day', 11);
    addUnitPriority('weekday', 11);
    addUnitPriority('isoWeekday', 11);

    // PARSING

    addRegexToken('d',    match1to2);
    addRegexToken('e',    match1to2);
    addRegexToken('E',    match1to2);
    addRegexToken('dd',   function (isStrict, locale) {
        return locale.weekdaysMinRegex(isStrict);
    });
    addRegexToken('ddd',   function (isStrict, locale) {
        return locale.weekdaysShortRegex(isStrict);
    });
    addRegexToken('dddd',   function (isStrict, locale) {
        return locale.weekdaysRegex(isStrict);
    });

    addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config, token) {
        var weekday = config._locale.weekdaysParse(input, token, config._strict);
        // if we didn't get a weekday name, mark the date as invalid
        if (weekday != null) {
            week.d = weekday;
        } else {
            getParsingFlags(config).invalidWeekday = input;
        }
    });

    addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
        week[token] = toInt(input);
    });

    // HELPERS

    function parseWeekday(input, locale) {
        if (typeof input !== 'string') {
            return input;
        }

        if (!isNaN(input)) {
            return parseInt(input, 10);
        }

        input = locale.weekdaysParse(input);
        if (typeof input === 'number') {
            return input;
        }

        return null;
    }

    function parseIsoWeekday(input, locale) {
        if (typeof input === 'string') {
            return locale.weekdaysParse(input) % 7 || 7;
        }
        return isNaN(input) ? null : input;
    }

    // LOCALES
    function shiftWeekdays (ws, n) {
        return ws.slice(n, 7).concat(ws.slice(0, n));
    }

    var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
    function localeWeekdays (m, format) {
        var weekdays = isArray(this._weekdays) ? this._weekdays :
            this._weekdays[(m && m !== true && this._weekdays.isFormat.test(format)) ? 'format' : 'standalone'];
        return (m === true) ? shiftWeekdays(weekdays, this._week.dow)
            : (m) ? weekdays[m.day()] : weekdays;
    }

    var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
    function localeWeekdaysShort (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysShort, this._week.dow)
            : (m) ? this._weekdaysShort[m.day()] : this._weekdaysShort;
    }

    var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
    function localeWeekdaysMin (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysMin, this._week.dow)
            : (m) ? this._weekdaysMin[m.day()] : this._weekdaysMin;
    }

    function handleStrictParse$1(weekdayName, format, strict) {
        var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._minWeekdaysParse = [];

            for (i = 0; i < 7; ++i) {
                mom = createUTC([2000, 1]).day(i);
                this._minWeekdaysParse[i] = this.weekdaysMin(mom, '').toLocaleLowerCase();
                this._shortWeekdaysParse[i] = this.weekdaysShort(mom, '').toLocaleLowerCase();
                this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeWeekdaysParse (weekdayName, format, strict) {
        var i, mom, regex;

        if (this._weekdaysParseExact) {
            return handleStrictParse$1.call(this, weekdayName, format, strict);
        }

        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._minWeekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._fullWeekdaysParse = [];
        }

        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already

            mom = createUTC([2000, 1]).day(i);
            if (strict && !this._fullWeekdaysParse[i]) {
                this._fullWeekdaysParse[i] = new RegExp('^' + this.weekdays(mom, '').replace('.', '\\.?') + '$', 'i');
                this._shortWeekdaysParse[i] = new RegExp('^' + this.weekdaysShort(mom, '').replace('.', '\\.?') + '$', 'i');
                this._minWeekdaysParse[i] = new RegExp('^' + this.weekdaysMin(mom, '').replace('.', '\\.?') + '$', 'i');
            }
            if (!this._weekdaysParse[i]) {
                regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'dddd' && this._fullWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'ddd' && this._shortWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'dd' && this._minWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function getSetDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
        if (input != null) {
            input = parseWeekday(input, this.localeData());
            return this.add(input - day, 'd');
        } else {
            return day;
        }
    }

    function getSetLocaleDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
        return input == null ? weekday : this.add(input - weekday, 'd');
    }

    function getSetISODayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }

        // behaves the same as moment#day except
        // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
        // as a setter, sunday should belong to the previous week.

        if (input != null) {
            var weekday = parseIsoWeekday(input, this.localeData());
            return this.day(this.day() % 7 ? weekday : weekday - 7);
        } else {
            return this.day() || 7;
        }
    }

    var defaultWeekdaysRegex = matchWord;
    function weekdaysRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysStrictRegex;
            } else {
                return this._weekdaysRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                this._weekdaysRegex = defaultWeekdaysRegex;
            }
            return this._weekdaysStrictRegex && isStrict ?
                this._weekdaysStrictRegex : this._weekdaysRegex;
        }
    }

    var defaultWeekdaysShortRegex = matchWord;
    function weekdaysShortRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysShortStrictRegex;
            } else {
                return this._weekdaysShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysShortRegex')) {
                this._weekdaysShortRegex = defaultWeekdaysShortRegex;
            }
            return this._weekdaysShortStrictRegex && isStrict ?
                this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
        }
    }

    var defaultWeekdaysMinRegex = matchWord;
    function weekdaysMinRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysMinStrictRegex;
            } else {
                return this._weekdaysMinRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysMinRegex')) {
                this._weekdaysMinRegex = defaultWeekdaysMinRegex;
            }
            return this._weekdaysMinStrictRegex && isStrict ?
                this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
        }
    }


    function computeWeekdaysParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom, minp, shortp, longp;
        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, 1]).day(i);
            minp = this.weekdaysMin(mom, '');
            shortp = this.weekdaysShort(mom, '');
            longp = this.weekdays(mom, '');
            minPieces.push(minp);
            shortPieces.push(shortp);
            longPieces.push(longp);
            mixedPieces.push(minp);
            mixedPieces.push(shortp);
            mixedPieces.push(longp);
        }
        // Sorting makes sure if one weekday (or abbr) is a prefix of another it
        // will match the longer piece.
        minPieces.sort(cmpLenRev);
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 7; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._weekdaysRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._weekdaysShortRegex = this._weekdaysRegex;
        this._weekdaysMinRegex = this._weekdaysRegex;

        this._weekdaysStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._weekdaysShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
        this._weekdaysMinStrictRegex = new RegExp('^(' + minPieces.join('|') + ')', 'i');
    }

    // FORMATTING

    function hFormat() {
        return this.hours() % 12 || 12;
    }

    function kFormat() {
        return this.hours() || 24;
    }

    addFormatToken('H', ['HH', 2], 0, 'hour');
    addFormatToken('h', ['hh', 2], 0, hFormat);
    addFormatToken('k', ['kk', 2], 0, kFormat);

    addFormatToken('hmm', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2);
    });

    addFormatToken('hmmss', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    addFormatToken('Hmm', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2);
    });

    addFormatToken('Hmmss', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    function meridiem (token, lowercase) {
        addFormatToken(token, 0, 0, function () {
            return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
        });
    }

    meridiem('a', true);
    meridiem('A', false);

    // ALIASES

    addUnitAlias('hour', 'h');

    // PRIORITY
    addUnitPriority('hour', 13);

    // PARSING

    function matchMeridiem (isStrict, locale) {
        return locale._meridiemParse;
    }

    addRegexToken('a',  matchMeridiem);
    addRegexToken('A',  matchMeridiem);
    addRegexToken('H',  match1to2);
    addRegexToken('h',  match1to2);
    addRegexToken('k',  match1to2);
    addRegexToken('HH', match1to2, match2);
    addRegexToken('hh', match1to2, match2);
    addRegexToken('kk', match1to2, match2);

    addRegexToken('hmm', match3to4);
    addRegexToken('hmmss', match5to6);
    addRegexToken('Hmm', match3to4);
    addRegexToken('Hmmss', match5to6);

    addParseToken(['H', 'HH'], HOUR);
    addParseToken(['k', 'kk'], function (input, array, config) {
        var kInput = toInt(input);
        array[HOUR] = kInput === 24 ? 0 : kInput;
    });
    addParseToken(['a', 'A'], function (input, array, config) {
        config._isPm = config._locale.isPM(input);
        config._meridiem = input;
    });
    addParseToken(['h', 'hh'], function (input, array, config) {
        array[HOUR] = toInt(input);
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('Hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
    });
    addParseToken('Hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
    });

    // LOCALES

    function localeIsPM (input) {
        // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
        // Using charAt should be more compatible.
        return ((input + '').toLowerCase().charAt(0) === 'p');
    }

    var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
    function localeMeridiem (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? 'pm' : 'PM';
        } else {
            return isLower ? 'am' : 'AM';
        }
    }


    // MOMENTS

    // Setting the hour should keep the time, because the user explicitly
    // specified which hour they want. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    var getSetHour = makeGetSet('Hours', true);

    var baseConfig = {
        calendar: defaultCalendar,
        longDateFormat: defaultLongDateFormat,
        invalidDate: defaultInvalidDate,
        ordinal: defaultOrdinal,
        dayOfMonthOrdinalParse: defaultDayOfMonthOrdinalParse,
        relativeTime: defaultRelativeTime,

        months: defaultLocaleMonths,
        monthsShort: defaultLocaleMonthsShort,

        week: defaultLocaleWeek,

        weekdays: defaultLocaleWeekdays,
        weekdaysMin: defaultLocaleWeekdaysMin,
        weekdaysShort: defaultLocaleWeekdaysShort,

        meridiemParse: defaultLocaleMeridiemParse
    };

    // internal storage for locale config files
    var locales = {};
    var localeFamilies = {};
    var globalLocale;

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return globalLocale;
    }

    function loadLocale(name) {
        var oldLocale = null;
        // TODO: Find a better way to register and load all the locales in Node
        if (!locales[name] && (typeof module !== 'undefined') &&
                module && module.exports) {
            try {
                oldLocale = globalLocale._abbr;
                var aliasedRequire = require;
                aliasedRequire('./locale/' + name);
                getSetGlobalLocale(oldLocale);
            } catch (e) {}
        }
        return locales[name];
    }

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    function getSetGlobalLocale (key, values) {
        var data;
        if (key) {
            if (isUndefined(values)) {
                data = getLocale(key);
            }
            else {
                data = defineLocale(key, values);
            }

            if (data) {
                // moment.duration._locale = moment._locale = data;
                globalLocale = data;
            }
            else {
                if ((typeof console !==  'undefined') && console.warn) {
                    //warn user if arguments are passed but the locale could not be set
                    console.warn('Locale ' + key +  ' not found. Did you forget to load it?');
                }
            }
        }

        return globalLocale._abbr;
    }

    function defineLocale (name, config) {
        if (config !== null) {
            var locale, parentConfig = baseConfig;
            config.abbr = name;
            if (locales[name] != null) {
                deprecateSimple('defineLocaleOverride',
                        'use moment.updateLocale(localeName, config) to change ' +
                        'an existing locale. moment.defineLocale(localeName, ' +
                        'config) should only be used for creating a new locale ' +
                        'See http://momentjs.com/guides/#/warnings/define-locale/ for more info.');
                parentConfig = locales[name]._config;
            } else if (config.parentLocale != null) {
                if (locales[config.parentLocale] != null) {
                    parentConfig = locales[config.parentLocale]._config;
                } else {
                    locale = loadLocale(config.parentLocale);
                    if (locale != null) {
                        parentConfig = locale._config;
                    } else {
                        if (!localeFamilies[config.parentLocale]) {
                            localeFamilies[config.parentLocale] = [];
                        }
                        localeFamilies[config.parentLocale].push({
                            name: name,
                            config: config
                        });
                        return null;
                    }
                }
            }
            locales[name] = new Locale(mergeConfigs(parentConfig, config));

            if (localeFamilies[name]) {
                localeFamilies[name].forEach(function (x) {
                    defineLocale(x.name, x.config);
                });
            }

            // backwards compat for now: also set the locale
            // make sure we set the locale AFTER all child locales have been
            // created, so we won't end up with the child locale set.
            getSetGlobalLocale(name);


            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    }

    function updateLocale(name, config) {
        if (config != null) {
            var locale, tmpLocale, parentConfig = baseConfig;
            // MERGE
            tmpLocale = loadLocale(name);
            if (tmpLocale != null) {
                parentConfig = tmpLocale._config;
            }
            config = mergeConfigs(parentConfig, config);
            locale = new Locale(config);
            locale.parentLocale = locales[name];
            locales[name] = locale;

            // backwards compat for now: also set the locale
            getSetGlobalLocale(name);
        } else {
            // pass null for config to unupdate, useful for tests
            if (locales[name] != null) {
                if (locales[name].parentLocale != null) {
                    locales[name] = locales[name].parentLocale;
                } else if (locales[name] != null) {
                    delete locales[name];
                }
            }
        }
        return locales[name];
    }

    // returns locale data
    function getLocale (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return globalLocale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    }

    function listLocales() {
        return keys(locales);
    }

    function checkOverflow (m) {
        var overflow;
        var a = m._a;

        if (a && getParsingFlags(m).overflow === -2) {
            overflow =
                a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
                a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
                a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
                a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
                a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
                a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }
            if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
                overflow = WEEK;
            }
            if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
                overflow = WEEKDAY;
            }

            getParsingFlags(m).overflow = overflow;
        }

        return m;
    }

    // Pick the first defined of two or three arguments.
    function defaults(a, b, c) {
        if (a != null) {
            return a;
        }
        if (b != null) {
            return b;
        }
        return c;
    }

    function currentDateArray(config) {
        // hooks is actually the exported moment object
        var nowValue = new Date(hooks.now());
        if (config._useUTC) {
            return [nowValue.getUTCFullYear(), nowValue.getUTCMonth(), nowValue.getUTCDate()];
        }
        return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function configFromArray (config) {
        var i, date, input = [], currentDate, expectedWeekday, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear != null) {
            yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse) || config._dayOfYear === 0) {
                getParsingFlags(config)._overflowDayOfYear = true;
            }

            date = createUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
        expectedWeekday = config._useUTC ? config._d.getUTCDay() : config._d.getDay();

        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }

        // check for mismatching day of week
        if (config._w && typeof config._w.d !== 'undefined' && config._w.d !== expectedWeekday) {
            getParsingFlags(config).weekdayMismatch = true;
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(createLocal(), 1, 4).year);
            week = defaults(w.W, 1);
            weekday = defaults(w.E, 1);
            if (weekday < 1 || weekday > 7) {
                weekdayOverflow = true;
            }
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            var curWeek = weekOfYear(createLocal(), dow, doy);

            weekYear = defaults(w.gg, config._a[YEAR], curWeek.year);

            // Default to current week.
            week = defaults(w.w, curWeek.week);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < 0 || weekday > 6) {
                    weekdayOverflow = true;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from beginning of week
                weekday = w.e + dow;
                if (w.e < 0 || w.e > 6) {
                    weekdayOverflow = true;
                }
            } else {
                // default to beginning of week
                weekday = dow;
            }
        }
        if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
            getParsingFlags(config)._overflowWeeks = true;
        } else if (weekdayOverflow != null) {
            getParsingFlags(config)._overflowWeekday = true;
        } else {
            temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
            config._a[YEAR] = temp.year;
            config._dayOfYear = temp.dayOfYear;
        }
    }

    // iso 8601 regex
    // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
    var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
    var basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;

    var tzRegex = /Z|[+-]\d\d(?::?\d\d)?/;

    var isoDates = [
        ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
        ['YYYY-MM-DD', /\d{4}-\d\d-\d\d/],
        ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
        ['GGGG-[W]WW', /\d{4}-W\d\d/, false],
        ['YYYY-DDD', /\d{4}-\d{3}/],
        ['YYYY-MM', /\d{4}-\d\d/, false],
        ['YYYYYYMMDD', /[+-]\d{10}/],
        ['YYYYMMDD', /\d{8}/],
        // YYYYMM is NOT allowed by the standard
        ['GGGG[W]WWE', /\d{4}W\d{3}/],
        ['GGGG[W]WW', /\d{4}W\d{2}/, false],
        ['YYYYDDD', /\d{7}/]
    ];

    // iso time formats and regexes
    var isoTimes = [
        ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
        ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
        ['HH:mm:ss', /\d\d:\d\d:\d\d/],
        ['HH:mm', /\d\d:\d\d/],
        ['HHmmss.SSSS', /\d\d\d\d\d\d\.\d+/],
        ['HHmmss,SSSS', /\d\d\d\d\d\d,\d+/],
        ['HHmmss', /\d\d\d\d\d\d/],
        ['HHmm', /\d\d\d\d/],
        ['HH', /\d\d/]
    ];

    var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

    // date from iso format
    function configFromISO(config) {
        var i, l,
            string = config._i,
            match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string),
            allowTime, dateFormat, timeFormat, tzFormat;

        if (match) {
            getParsingFlags(config).iso = true;

            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(match[1])) {
                    dateFormat = isoDates[i][0];
                    allowTime = isoDates[i][2] !== false;
                    break;
                }
            }
            if (dateFormat == null) {
                config._isValid = false;
                return;
            }
            if (match[3]) {
                for (i = 0, l = isoTimes.length; i < l; i++) {
                    if (isoTimes[i][1].exec(match[3])) {
                        // match[2] should be 'T' or space
                        timeFormat = (match[2] || ' ') + isoTimes[i][0];
                        break;
                    }
                }
                if (timeFormat == null) {
                    config._isValid = false;
                    return;
                }
            }
            if (!allowTime && timeFormat != null) {
                config._isValid = false;
                return;
            }
            if (match[4]) {
                if (tzRegex.exec(match[4])) {
                    tzFormat = 'Z';
                } else {
                    config._isValid = false;
                    return;
                }
            }
            config._f = dateFormat + (timeFormat || '') + (tzFormat || '');
            configFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // RFC 2822 regex: For details see https://tools.ietf.org/html/rfc2822#section-3.3
    var rfc2822 = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d\d):(\d\d)(?::(\d\d))?\s(?:(UT|GMT|[ECMP][SD]T)|([Zz])|([+-]\d{4}))$/;

    function extractFromRFC2822Strings(yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr) {
        var result = [
            untruncateYear(yearStr),
            defaultLocaleMonthsShort.indexOf(monthStr),
            parseInt(dayStr, 10),
            parseInt(hourStr, 10),
            parseInt(minuteStr, 10)
        ];

        if (secondStr) {
            result.push(parseInt(secondStr, 10));
        }

        return result;
    }

    function untruncateYear(yearStr) {
        var year = parseInt(yearStr, 10);
        if (year <= 49) {
            return 2000 + year;
        } else if (year <= 999) {
            return 1900 + year;
        }
        return year;
    }

    function preprocessRFC2822(s) {
        // Remove comments and folding whitespace and replace multiple-spaces with a single space
        return s.replace(/\([^)]*\)|[\n\t]/g, ' ').replace(/(\s\s+)/g, ' ').replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    }

    function checkWeekday(weekdayStr, parsedInput, config) {
        if (weekdayStr) {
            // TODO: Replace the vanilla JS Date object with an indepentent day-of-week check.
            var weekdayProvided = defaultLocaleWeekdaysShort.indexOf(weekdayStr),
                weekdayActual = new Date(parsedInput[0], parsedInput[1], parsedInput[2]).getDay();
            if (weekdayProvided !== weekdayActual) {
                getParsingFlags(config).weekdayMismatch = true;
                config._isValid = false;
                return false;
            }
        }
        return true;
    }

    var obsOffsets = {
        UT: 0,
        GMT: 0,
        EDT: -4 * 60,
        EST: -5 * 60,
        CDT: -5 * 60,
        CST: -6 * 60,
        MDT: -6 * 60,
        MST: -7 * 60,
        PDT: -7 * 60,
        PST: -8 * 60
    };

    function calculateOffset(obsOffset, militaryOffset, numOffset) {
        if (obsOffset) {
            return obsOffsets[obsOffset];
        } else if (militaryOffset) {
            // the only allowed military tz is Z
            return 0;
        } else {
            var hm = parseInt(numOffset, 10);
            var m = hm % 100, h = (hm - m) / 100;
            return h * 60 + m;
        }
    }

    // date and time from ref 2822 format
    function configFromRFC2822(config) {
        var match = rfc2822.exec(preprocessRFC2822(config._i));
        if (match) {
            var parsedArray = extractFromRFC2822Strings(match[4], match[3], match[2], match[5], match[6], match[7]);
            if (!checkWeekday(match[1], parsedArray, config)) {
                return;
            }

            config._a = parsedArray;
            config._tzm = calculateOffset(match[8], match[9], match[10]);

            config._d = createUTCDate.apply(null, config._a);
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);

            getParsingFlags(config).rfc2822 = true;
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function configFromString(config) {
        var matched = aspNetJsonRegex.exec(config._i);

        if (matched !== null) {
            config._d = new Date(+matched[1]);
            return;
        }

        configFromISO(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        configFromRFC2822(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        // Final attempt, use Input Fallback
        hooks.createFromInputFallback(config);
    }

    hooks.createFromInputFallback = deprecate(
        'value provided is not in a recognized RFC2822 or ISO format. moment construction falls back to js Date(), ' +
        'which is not reliable across all browsers and versions. Non RFC2822/ISO date formats are ' +
        'discouraged and will be removed in an upcoming major release. Please refer to ' +
        'http://momentjs.com/guides/#/warnings/js-date/ for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    // constant that refers to the ISO standard
    hooks.ISO_8601 = function () {};

    // constant that refers to the RFC 2822 form
    hooks.RFC_2822 = function () {};

    // date from string and format string
    function configFromStringAndFormat(config) {
        // TODO: Move this to another part of the creation flow to prevent circular deps
        if (config._f === hooks.ISO_8601) {
            configFromISO(config);
            return;
        }
        if (config._f === hooks.RFC_2822) {
            configFromRFC2822(config);
            return;
        }
        config._a = [];
        getParsingFlags(config).empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            // console.log('token', token, 'parsedInput', parsedInput,
            //         'regex', getParseRegexForToken(token, config));
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    getParsingFlags(config).unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    getParsingFlags(config).empty = false;
                }
                else {
                    getParsingFlags(config).unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                getParsingFlags(config).unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            getParsingFlags(config).unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (config._a[HOUR] <= 12 &&
            getParsingFlags(config).bigHour === true &&
            config._a[HOUR] > 0) {
            getParsingFlags(config).bigHour = undefined;
        }

        getParsingFlags(config).parsedDateParts = config._a.slice(0);
        getParsingFlags(config).meridiem = config._meridiem;
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

        configFromArray(config);
        checkOverflow(config);
    }


    function meridiemFixWrap (locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // this is not supposed to happen
            return hour;
        }
    }

    // date from string and array of format strings
    function configFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            getParsingFlags(config).invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._f = config._f[i];
            configFromStringAndFormat(tempConfig);

            if (!isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += getParsingFlags(tempConfig).charsLeftOver;

            //or tokens
            currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

            getParsingFlags(tempConfig).score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    function configFromObject(config) {
        if (config._d) {
            return;
        }

        var i = normalizeObjectUnits(config._i);
        config._a = map([i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond], function (obj) {
            return obj && parseInt(obj, 10);
        });

        configFromArray(config);
    }

    function createFromConfig (config) {
        var res = new Moment(checkOverflow(prepareConfig(config)));
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    function prepareConfig (config) {
        var input = config._i,
            format = config._f;

        config._locale = config._locale || getLocale(config._l);

        if (input === null || (format === undefined && input === '')) {
            return createInvalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (isMoment(input)) {
            return new Moment(checkOverflow(input));
        } else if (isDate(input)) {
            config._d = input;
        } else if (isArray(format)) {
            configFromStringAndArray(config);
        } else if (format) {
            configFromStringAndFormat(config);
        }  else {
            configFromInput(config);
        }

        if (!isValid(config)) {
            config._d = null;
        }

        return config;
    }

    function configFromInput(config) {
        var input = config._i;
        if (isUndefined(input)) {
            config._d = new Date(hooks.now());
        } else if (isDate(input)) {
            config._d = new Date(input.valueOf());
        } else if (typeof input === 'string') {
            configFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            configFromArray(config);
        } else if (isObject(input)) {
            configFromObject(config);
        } else if (isNumber(input)) {
            // from milliseconds
            config._d = new Date(input);
        } else {
            hooks.createFromInputFallback(config);
        }
    }

    function createLocalOrUTC (input, format, locale, strict, isUTC) {
        var c = {};

        if (locale === true || locale === false) {
            strict = locale;
            locale = undefined;
        }

        if ((isObject(input) && isObjectEmpty(input)) ||
                (isArray(input) && input.length === 0)) {
            input = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c._isAMomentObject = true;
        c._useUTC = c._isUTC = isUTC;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;

        return createFromConfig(c);
    }

    function createLocal (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, false);
    }

    var prototypeMin = deprecate(
        'moment().min is deprecated, use moment.max instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other < this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    var prototypeMax = deprecate(
        'moment().max is deprecated, use moment.min instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other > this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return createLocal();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (!moments[i].isValid() || moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    // TODO: Use [].sort instead?
    function min () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    }

    function max () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    }

    var now = function () {
        return Date.now ? Date.now() : +(new Date());
    };

    var ordering = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'];

    function isDurationValid(m) {
        for (var key in m) {
            if (!(indexOf.call(ordering, key) !== -1 && (m[key] == null || !isNaN(m[key])))) {
                return false;
            }
        }

        var unitHasDecimal = false;
        for (var i = 0; i < ordering.length; ++i) {
            if (m[ordering[i]]) {
                if (unitHasDecimal) {
                    return false; // only allow non-integers for smallest unit
                }
                if (parseFloat(m[ordering[i]]) !== toInt(m[ordering[i]])) {
                    unitHasDecimal = true;
                }
            }
        }

        return true;
    }

    function isValid$1() {
        return this._isValid;
    }

    function createInvalid$1() {
        return createDuration(NaN);
    }

    function Duration (duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || normalizedInput.isoWeek || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        this._isValid = isDurationValid(normalizedInput);

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 1000 * 60 * 60; //using 1000 * 60 * 60 instead of 36e5 to avoid floating point rounding errors https://github.com/moment/moment/issues/2978
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible to translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = getLocale();

        this._bubble();
    }

    function isDuration (obj) {
        return obj instanceof Duration;
    }

    function absRound (number) {
        if (number < 0) {
            return Math.round(-1 * number) * -1;
        } else {
            return Math.round(number);
        }
    }

    // FORMATTING

    function offset (token, separator) {
        addFormatToken(token, 0, 0, function () {
            var offset = this.utcOffset();
            var sign = '+';
            if (offset < 0) {
                offset = -offset;
                sign = '-';
            }
            return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
        });
    }

    offset('Z', ':');
    offset('ZZ', '');

    // PARSING

    addRegexToken('Z',  matchShortOffset);
    addRegexToken('ZZ', matchShortOffset);
    addParseToken(['Z', 'ZZ'], function (input, array, config) {
        config._useUTC = true;
        config._tzm = offsetFromString(matchShortOffset, input);
    });

    // HELPERS

    // timezone chunker
    // '+10:00' > ['10',  '00']
    // '-1530'  > ['-15', '30']
    var chunkOffset = /([\+\-]|\d\d)/gi;

    function offsetFromString(matcher, string) {
        var matches = (string || '').match(matcher);

        if (matches === null) {
            return null;
        }

        var chunk   = matches[matches.length - 1] || [];
        var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
        var minutes = +(parts[1] * 60) + toInt(parts[2]);

        return minutes === 0 ?
          0 :
          parts[0] === '+' ? minutes : -minutes;
    }

    // Return a moment from input, that is local/utc/zone equivalent to model.
    function cloneWithOffset(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (isMoment(input) || isDate(input) ? input.valueOf() : createLocal(input).valueOf()) - res.valueOf();
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(res._d.valueOf() + diff);
            hooks.updateOffset(res, false);
            return res;
        } else {
            return createLocal(input).local();
        }
    }

    function getDateOffset (m) {
        // On Firefox.24 Date#getTimezoneOffset returns a floating point.
        // https://github.com/moment/moment/pull/1871
        return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
    }

    // HOOKS

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    hooks.updateOffset = function () {};

    // MOMENTS

    // keepLocalTime = true means only change the timezone, without
    // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
    // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
    // +0200, so we adjust the time as needed, to be valid.
    //
    // Keeping the time actually adds/subtracts (one hour)
    // from the actual represented time. That is why we call updateOffset
    // a second time. In case it wants us to change the offset again
    // _changeInProgress == true case, then we have to adjust, because
    // there is no such time in the given timezone.
    function getSetOffset (input, keepLocalTime, keepMinutes) {
        var offset = this._offset || 0,
            localAdjust;
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        if (input != null) {
            if (typeof input === 'string') {
                input = offsetFromString(matchShortOffset, input);
                if (input === null) {
                    return this;
                }
            } else if (Math.abs(input) < 16 && !keepMinutes) {
                input = input * 60;
            }
            if (!this._isUTC && keepLocalTime) {
                localAdjust = getDateOffset(this);
            }
            this._offset = input;
            this._isUTC = true;
            if (localAdjust != null) {
                this.add(localAdjust, 'm');
            }
            if (offset !== input) {
                if (!keepLocalTime || this._changeInProgress) {
                    addSubtract(this, createDuration(input - offset, 'm'), 1, false);
                } else if (!this._changeInProgress) {
                    this._changeInProgress = true;
                    hooks.updateOffset(this, true);
                    this._changeInProgress = null;
                }
            }
            return this;
        } else {
            return this._isUTC ? offset : getDateOffset(this);
        }
    }

    function getSetZone (input, keepLocalTime) {
        if (input != null) {
            if (typeof input !== 'string') {
                input = -input;
            }

            this.utcOffset(input, keepLocalTime);

            return this;
        } else {
            return -this.utcOffset();
        }
    }

    function setOffsetToUTC (keepLocalTime) {
        return this.utcOffset(0, keepLocalTime);
    }

    function setOffsetToLocal (keepLocalTime) {
        if (this._isUTC) {
            this.utcOffset(0, keepLocalTime);
            this._isUTC = false;

            if (keepLocalTime) {
                this.subtract(getDateOffset(this), 'm');
            }
        }
        return this;
    }

    function setOffsetToParsedOffset () {
        if (this._tzm != null) {
            this.utcOffset(this._tzm, false, true);
        } else if (typeof this._i === 'string') {
            var tZone = offsetFromString(matchOffset, this._i);
            if (tZone != null) {
                this.utcOffset(tZone);
            }
            else {
                this.utcOffset(0, true);
            }
        }
        return this;
    }

    function hasAlignedHourOffset (input) {
        if (!this.isValid()) {
            return false;
        }
        input = input ? createLocal(input).utcOffset() : 0;

        return (this.utcOffset() - input) % 60 === 0;
    }

    function isDaylightSavingTime () {
        return (
            this.utcOffset() > this.clone().month(0).utcOffset() ||
            this.utcOffset() > this.clone().month(5).utcOffset()
        );
    }

    function isDaylightSavingTimeShifted () {
        if (!isUndefined(this._isDSTShifted)) {
            return this._isDSTShifted;
        }

        var c = {};

        copyConfig(c, this);
        c = prepareConfig(c);

        if (c._a) {
            var other = c._isUTC ? createUTC(c._a) : createLocal(c._a);
            this._isDSTShifted = this.isValid() &&
                compareArrays(c._a, other.toArray()) > 0;
        } else {
            this._isDSTShifted = false;
        }

        return this._isDSTShifted;
    }

    function isLocal () {
        return this.isValid() ? !this._isUTC : false;
    }

    function isUtcOffset () {
        return this.isValid() ? this._isUTC : false;
    }

    function isUtc () {
        return this.isValid() ? this._isUTC && this._offset === 0 : false;
    }

    // ASP.NET json date format regex
    var aspNetRegex = /^(\-|\+)?(?:(\d*)[. ])?(\d+)\:(\d+)(?:\:(\d+)(\.\d*)?)?$/;

    // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
    // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
    // and further modified to allow for strings containing both week and day
    var isoRegex = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/;

    function createDuration (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            diffRes;

        if (isDuration(input)) {
            duration = {
                ms : input._milliseconds,
                d  : input._days,
                M  : input._months
            };
        } else if (isNumber(input)) {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y  : 0,
                d  : toInt(match[DATE])                         * sign,
                h  : toInt(match[HOUR])                         * sign,
                m  : toInt(match[MINUTE])                       * sign,
                s  : toInt(match[SECOND])                       * sign,
                ms : toInt(absRound(match[MILLISECOND] * 1000)) * sign // the millisecond decimal point is included in the match
            };
        } else if (!!(match = isoRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y : parseIso(match[2], sign),
                M : parseIso(match[3], sign),
                w : parseIso(match[4], sign),
                d : parseIso(match[5], sign),
                h : parseIso(match[6], sign),
                m : parseIso(match[7], sign),
                s : parseIso(match[8], sign)
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(createLocal(duration.from), createLocal(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    }

    createDuration.fn = Duration.prototype;
    createDuration.invalid = createInvalid$1;

    function parseIso (inp, sign) {
        // We'd normally use ~~inp for this, but unfortunately it also
        // converts floats to ints.
        // inp may be undefined, so careful calling replace on it.
        var res = inp && parseFloat(inp.replace(',', '.'));
        // apply sign while we're at it
        return (isNaN(res) ? 0 : res) * sign;
    }

    function positiveMomentsDifference(base, other) {
        var res = {};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        if (!(base.isValid() && other.isValid())) {
            return {milliseconds: 0, months: 0};
        }

        other = cloneWithOffset(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period). ' +
                'See http://momentjs.com/guides/#/warnings/add-inverted-param/ for more info.');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = createDuration(val, period);
            addSubtract(this, dur, direction);
            return this;
        };
    }

    function addSubtract (mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = absRound(duration._days),
            months = absRound(duration._months);

        if (!mom.isValid()) {
            // No op
            return;
        }

        updateOffset = updateOffset == null ? true : updateOffset;

        if (months) {
            setMonth(mom, get(mom, 'Month') + months * isAdding);
        }
        if (days) {
            set$1(mom, 'Date', get(mom, 'Date') + days * isAdding);
        }
        if (milliseconds) {
            mom._d.setTime(mom._d.valueOf() + milliseconds * isAdding);
        }
        if (updateOffset) {
            hooks.updateOffset(mom, days || months);
        }
    }

    var add      = createAdder(1, 'add');
    var subtract = createAdder(-1, 'subtract');

    function getCalendarFormat(myMoment, now) {
        var diff = myMoment.diff(now, 'days', true);
        return diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';
    }

    function calendar$1 (time, formats) {
        // We want to compare the start of today, vs this.
        // Getting start-of-today depends on whether we're local/utc/offset or not.
        var now = time || createLocal(),
            sod = cloneWithOffset(now, this).startOf('day'),
            format = hooks.calendarFormat(this, sod) || 'sameElse';

        var output = formats && (isFunction(formats[format]) ? formats[format].call(this, now) : formats[format]);

        return this.format(output || this.localeData().calendar(format, this, createLocal(now)));
    }

    function clone () {
        return new Moment(this);
    }

    function isAfter (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() > localInput.valueOf();
        } else {
            return localInput.valueOf() < this.clone().startOf(units).valueOf();
        }
    }

    function isBefore (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() < localInput.valueOf();
        } else {
            return this.clone().endOf(units).valueOf() < localInput.valueOf();
        }
    }

    function isBetween (from, to, units, inclusivity) {
        var localFrom = isMoment(from) ? from : createLocal(from),
            localTo = isMoment(to) ? to : createLocal(to);
        if (!(this.isValid() && localFrom.isValid() && localTo.isValid())) {
            return false;
        }
        inclusivity = inclusivity || '()';
        return (inclusivity[0] === '(' ? this.isAfter(localFrom, units) : !this.isBefore(localFrom, units)) &&
            (inclusivity[1] === ')' ? this.isBefore(localTo, units) : !this.isAfter(localTo, units));
    }

    function isSame (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input),
            inputMs;
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() === localInput.valueOf();
        } else {
            inputMs = localInput.valueOf();
            return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
        }
    }

    function isSameOrAfter (input, units) {
        return this.isSame(input, units) || this.isAfter(input, units);
    }

    function isSameOrBefore (input, units) {
        return this.isSame(input, units) || this.isBefore(input, units);
    }

    function diff (input, units, asFloat) {
        var that,
            zoneDelta,
            output;

        if (!this.isValid()) {
            return NaN;
        }

        that = cloneWithOffset(input, this);

        if (!that.isValid()) {
            return NaN;
        }

        zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;

        units = normalizeUnits(units);

        switch (units) {
            case 'year': output = monthDiff(this, that) / 12; break;
            case 'month': output = monthDiff(this, that); break;
            case 'quarter': output = monthDiff(this, that) / 3; break;
            case 'second': output = (this - that) / 1e3; break; // 1000
            case 'minute': output = (this - that) / 6e4; break; // 1000 * 60
            case 'hour': output = (this - that) / 36e5; break; // 1000 * 60 * 60
            case 'day': output = (this - that - zoneDelta) / 864e5; break; // 1000 * 60 * 60 * 24, negate dst
            case 'week': output = (this - that - zoneDelta) / 6048e5; break; // 1000 * 60 * 60 * 24 * 7, negate dst
            default: output = this - that;
        }

        return asFloat ? output : absFloor(output);
    }

    function monthDiff (a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        //check for negative zero, return zero if negative zero
        return -(wholeMonthDiff + adjust) || 0;
    }

    hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
    hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

    function toString () {
        return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
    }

    function toISOString(keepOffset) {
        if (!this.isValid()) {
            return null;
        }
        var utc = keepOffset !== true;
        var m = utc ? this.clone().utc() : this;
        if (m.year() < 0 || m.year() > 9999) {
            return formatMoment(m, utc ? 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYYYY-MM-DD[T]HH:mm:ss.SSSZ');
        }
        if (isFunction(Date.prototype.toISOString)) {
            // native implementation is ~50x faster, use it when we can
            if (utc) {
                return this.toDate().toISOString();
            } else {
                return new Date(this.valueOf() + this.utcOffset() * 60 * 1000).toISOString().replace('Z', formatMoment(m, 'Z'));
            }
        }
        return formatMoment(m, utc ? 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYY-MM-DD[T]HH:mm:ss.SSSZ');
    }

    /**
     * Return a human readable representation of a moment that can
     * also be evaluated to get a new moment which is the same
     *
     * @link https://nodejs.org/dist/latest/docs/api/util.html#util_custom_inspect_function_on_objects
     */
    function inspect () {
        if (!this.isValid()) {
            return 'moment.invalid(/* ' + this._i + ' */)';
        }
        var func = 'moment';
        var zone = '';
        if (!this.isLocal()) {
            func = this.utcOffset() === 0 ? 'moment.utc' : 'moment.parseZone';
            zone = 'Z';
        }
        var prefix = '[' + func + '("]';
        var year = (0 <= this.year() && this.year() <= 9999) ? 'YYYY' : 'YYYYYY';
        var datetime = '-MM-DD[T]HH:mm:ss.SSS';
        var suffix = zone + '[")]';

        return this.format(prefix + year + datetime + suffix);
    }

    function format (inputString) {
        if (!inputString) {
            inputString = this.isUtc() ? hooks.defaultFormatUtc : hooks.defaultFormat;
        }
        var output = formatMoment(this, inputString);
        return this.localeData().postformat(output);
    }

    function from (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function fromNow (withoutSuffix) {
        return this.from(createLocal(), withoutSuffix);
    }

    function to (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function toNow (withoutSuffix) {
        return this.to(createLocal(), withoutSuffix);
    }

    // If passed a locale key, it will set the locale for this
    // instance.  Otherwise, it will return the locale configuration
    // variables for this instance.
    function locale (key) {
        var newLocaleData;

        if (key === undefined) {
            return this._locale._abbr;
        } else {
            newLocaleData = getLocale(key);
            if (newLocaleData != null) {
                this._locale = newLocaleData;
            }
            return this;
        }
    }

    var lang = deprecate(
        'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
        function (key) {
            if (key === undefined) {
                return this.localeData();
            } else {
                return this.locale(key);
            }
        }
    );

    function localeData () {
        return this._locale;
    }

    var MS_PER_SECOND = 1000;
    var MS_PER_MINUTE = 60 * MS_PER_SECOND;
    var MS_PER_HOUR = 60 * MS_PER_MINUTE;
    var MS_PER_400_YEARS = (365 * 400 + 97) * 24 * MS_PER_HOUR;

    // actual modulo - handles negative numbers (for dates before 1970):
    function mod$1(dividend, divisor) {
        return (dividend % divisor + divisor) % divisor;
    }

    function localStartOfDate(y, m, d) {
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return new Date(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return new Date(y, m, d).valueOf();
        }
    }

    function utcStartOfDate(y, m, d) {
        // Date.UTC remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return Date.UTC(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return Date.UTC(y, m, d);
        }
    }

    function startOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year(), 0, 1);
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3, 1);
                break;
            case 'month':
                time = startOfDate(this.year(), this.month(), 1);
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday());
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1));
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date());
                break;
            case 'hour':
                time = this._d.valueOf();
                time -= mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR);
                break;
            case 'minute':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_MINUTE);
                break;
            case 'second':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_SECOND);
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function endOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year() + 1, 0, 1) - 1;
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3 + 3, 1) - 1;
                break;
            case 'month':
                time = startOfDate(this.year(), this.month() + 1, 1) - 1;
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday() + 7) - 1;
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1) + 7) - 1;
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date() + 1) - 1;
                break;
            case 'hour':
                time = this._d.valueOf();
                time += MS_PER_HOUR - mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR) - 1;
                break;
            case 'minute':
                time = this._d.valueOf();
                time += MS_PER_MINUTE - mod$1(time, MS_PER_MINUTE) - 1;
                break;
            case 'second':
                time = this._d.valueOf();
                time += MS_PER_SECOND - mod$1(time, MS_PER_SECOND) - 1;
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function valueOf () {
        return this._d.valueOf() - ((this._offset || 0) * 60000);
    }

    function unix () {
        return Math.floor(this.valueOf() / 1000);
    }

    function toDate () {
        return new Date(this.valueOf());
    }

    function toArray () {
        var m = this;
        return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
    }

    function toObject () {
        var m = this;
        return {
            years: m.year(),
            months: m.month(),
            date: m.date(),
            hours: m.hours(),
            minutes: m.minutes(),
            seconds: m.seconds(),
            milliseconds: m.milliseconds()
        };
    }

    function toJSON () {
        // new Date(NaN).toJSON() === null
        return this.isValid() ? this.toISOString() : null;
    }

    function isValid$2 () {
        return isValid(this);
    }

    function parsingFlags () {
        return extend({}, getParsingFlags(this));
    }

    function invalidAt () {
        return getParsingFlags(this).overflow;
    }

    function creationData() {
        return {
            input: this._i,
            format: this._f,
            locale: this._locale,
            isUTC: this._isUTC,
            strict: this._strict
        };
    }

    // FORMATTING

    addFormatToken(0, ['gg', 2], 0, function () {
        return this.weekYear() % 100;
    });

    addFormatToken(0, ['GG', 2], 0, function () {
        return this.isoWeekYear() % 100;
    });

    function addWeekYearFormatToken (token, getter) {
        addFormatToken(0, [token, token.length], 0, getter);
    }

    addWeekYearFormatToken('gggg',     'weekYear');
    addWeekYearFormatToken('ggggg',    'weekYear');
    addWeekYearFormatToken('GGGG',  'isoWeekYear');
    addWeekYearFormatToken('GGGGG', 'isoWeekYear');

    // ALIASES

    addUnitAlias('weekYear', 'gg');
    addUnitAlias('isoWeekYear', 'GG');

    // PRIORITY

    addUnitPriority('weekYear', 1);
    addUnitPriority('isoWeekYear', 1);


    // PARSING

    addRegexToken('G',      matchSigned);
    addRegexToken('g',      matchSigned);
    addRegexToken('GG',     match1to2, match2);
    addRegexToken('gg',     match1to2, match2);
    addRegexToken('GGGG',   match1to4, match4);
    addRegexToken('gggg',   match1to4, match4);
    addRegexToken('GGGGG',  match1to6, match6);
    addRegexToken('ggggg',  match1to6, match6);

    addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
        week[token.substr(0, 2)] = toInt(input);
    });

    addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
        week[token] = hooks.parseTwoDigitYear(input);
    });

    // MOMENTS

    function getSetWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input,
                this.week(),
                this.weekday(),
                this.localeData()._week.dow,
                this.localeData()._week.doy);
    }

    function getSetISOWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input, this.isoWeek(), this.isoWeekday(), 1, 4);
    }

    function getISOWeeksInYear () {
        return weeksInYear(this.year(), 1, 4);
    }

    function getWeeksInYear () {
        var weekInfo = this.localeData()._week;
        return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
    }

    function getSetWeekYearHelper(input, week, weekday, dow, doy) {
        var weeksTarget;
        if (input == null) {
            return weekOfYear(this, dow, doy).year;
        } else {
            weeksTarget = weeksInYear(input, dow, doy);
            if (week > weeksTarget) {
                week = weeksTarget;
            }
            return setWeekAll.call(this, input, week, weekday, dow, doy);
        }
    }

    function setWeekAll(weekYear, week, weekday, dow, doy) {
        var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy),
            date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);

        this.year(date.getUTCFullYear());
        this.month(date.getUTCMonth());
        this.date(date.getUTCDate());
        return this;
    }

    // FORMATTING

    addFormatToken('Q', 0, 'Qo', 'quarter');

    // ALIASES

    addUnitAlias('quarter', 'Q');

    // PRIORITY

    addUnitPriority('quarter', 7);

    // PARSING

    addRegexToken('Q', match1);
    addParseToken('Q', function (input, array) {
        array[MONTH] = (toInt(input) - 1) * 3;
    });

    // MOMENTS

    function getSetQuarter (input) {
        return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
    }

    // FORMATTING

    addFormatToken('D', ['DD', 2], 'Do', 'date');

    // ALIASES

    addUnitAlias('date', 'D');

    // PRIORITY
    addUnitPriority('date', 9);

    // PARSING

    addRegexToken('D',  match1to2);
    addRegexToken('DD', match1to2, match2);
    addRegexToken('Do', function (isStrict, locale) {
        // TODO: Remove "ordinalParse" fallback in next major release.
        return isStrict ?
          (locale._dayOfMonthOrdinalParse || locale._ordinalParse) :
          locale._dayOfMonthOrdinalParseLenient;
    });

    addParseToken(['D', 'DD'], DATE);
    addParseToken('Do', function (input, array) {
        array[DATE] = toInt(input.match(match1to2)[0]);
    });

    // MOMENTS

    var getSetDayOfMonth = makeGetSet('Date', true);

    // FORMATTING

    addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

    // ALIASES

    addUnitAlias('dayOfYear', 'DDD');

    // PRIORITY
    addUnitPriority('dayOfYear', 4);

    // PARSING

    addRegexToken('DDD',  match1to3);
    addRegexToken('DDDD', match3);
    addParseToken(['DDD', 'DDDD'], function (input, array, config) {
        config._dayOfYear = toInt(input);
    });

    // HELPERS

    // MOMENTS

    function getSetDayOfYear (input) {
        var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
        return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
    }

    // FORMATTING

    addFormatToken('m', ['mm', 2], 0, 'minute');

    // ALIASES

    addUnitAlias('minute', 'm');

    // PRIORITY

    addUnitPriority('minute', 14);

    // PARSING

    addRegexToken('m',  match1to2);
    addRegexToken('mm', match1to2, match2);
    addParseToken(['m', 'mm'], MINUTE);

    // MOMENTS

    var getSetMinute = makeGetSet('Minutes', false);

    // FORMATTING

    addFormatToken('s', ['ss', 2], 0, 'second');

    // ALIASES

    addUnitAlias('second', 's');

    // PRIORITY

    addUnitPriority('second', 15);

    // PARSING

    addRegexToken('s',  match1to2);
    addRegexToken('ss', match1to2, match2);
    addParseToken(['s', 'ss'], SECOND);

    // MOMENTS

    var getSetSecond = makeGetSet('Seconds', false);

    // FORMATTING

    addFormatToken('S', 0, 0, function () {
        return ~~(this.millisecond() / 100);
    });

    addFormatToken(0, ['SS', 2], 0, function () {
        return ~~(this.millisecond() / 10);
    });

    addFormatToken(0, ['SSS', 3], 0, 'millisecond');
    addFormatToken(0, ['SSSS', 4], 0, function () {
        return this.millisecond() * 10;
    });
    addFormatToken(0, ['SSSSS', 5], 0, function () {
        return this.millisecond() * 100;
    });
    addFormatToken(0, ['SSSSSS', 6], 0, function () {
        return this.millisecond() * 1000;
    });
    addFormatToken(0, ['SSSSSSS', 7], 0, function () {
        return this.millisecond() * 10000;
    });
    addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
        return this.millisecond() * 100000;
    });
    addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
        return this.millisecond() * 1000000;
    });


    // ALIASES

    addUnitAlias('millisecond', 'ms');

    // PRIORITY

    addUnitPriority('millisecond', 16);

    // PARSING

    addRegexToken('S',    match1to3, match1);
    addRegexToken('SS',   match1to3, match2);
    addRegexToken('SSS',  match1to3, match3);

    var token;
    for (token = 'SSSS'; token.length <= 9; token += 'S') {
        addRegexToken(token, matchUnsigned);
    }

    function parseMs(input, array) {
        array[MILLISECOND] = toInt(('0.' + input) * 1000);
    }

    for (token = 'S'; token.length <= 9; token += 'S') {
        addParseToken(token, parseMs);
    }
    // MOMENTS

    var getSetMillisecond = makeGetSet('Milliseconds', false);

    // FORMATTING

    addFormatToken('z',  0, 0, 'zoneAbbr');
    addFormatToken('zz', 0, 0, 'zoneName');

    // MOMENTS

    function getZoneAbbr () {
        return this._isUTC ? 'UTC' : '';
    }

    function getZoneName () {
        return this._isUTC ? 'Coordinated Universal Time' : '';
    }

    var proto = Moment.prototype;

    proto.add               = add;
    proto.calendar          = calendar$1;
    proto.clone             = clone;
    proto.diff              = diff;
    proto.endOf             = endOf;
    proto.format            = format;
    proto.from              = from;
    proto.fromNow           = fromNow;
    proto.to                = to;
    proto.toNow             = toNow;
    proto.get               = stringGet;
    proto.invalidAt         = invalidAt;
    proto.isAfter           = isAfter;
    proto.isBefore          = isBefore;
    proto.isBetween         = isBetween;
    proto.isSame            = isSame;
    proto.isSameOrAfter     = isSameOrAfter;
    proto.isSameOrBefore    = isSameOrBefore;
    proto.isValid           = isValid$2;
    proto.lang              = lang;
    proto.locale            = locale;
    proto.localeData        = localeData;
    proto.max               = prototypeMax;
    proto.min               = prototypeMin;
    proto.parsingFlags      = parsingFlags;
    proto.set               = stringSet;
    proto.startOf           = startOf;
    proto.subtract          = subtract;
    proto.toArray           = toArray;
    proto.toObject          = toObject;
    proto.toDate            = toDate;
    proto.toISOString       = toISOString;
    proto.inspect           = inspect;
    proto.toJSON            = toJSON;
    proto.toString          = toString;
    proto.unix              = unix;
    proto.valueOf           = valueOf;
    proto.creationData      = creationData;
    proto.year       = getSetYear;
    proto.isLeapYear = getIsLeapYear;
    proto.weekYear    = getSetWeekYear;
    proto.isoWeekYear = getSetISOWeekYear;
    proto.quarter = proto.quarters = getSetQuarter;
    proto.month       = getSetMonth;
    proto.daysInMonth = getDaysInMonth;
    proto.week           = proto.weeks        = getSetWeek;
    proto.isoWeek        = proto.isoWeeks     = getSetISOWeek;
    proto.weeksInYear    = getWeeksInYear;
    proto.isoWeeksInYear = getISOWeeksInYear;
    proto.date       = getSetDayOfMonth;
    proto.day        = proto.days             = getSetDayOfWeek;
    proto.weekday    = getSetLocaleDayOfWeek;
    proto.isoWeekday = getSetISODayOfWeek;
    proto.dayOfYear  = getSetDayOfYear;
    proto.hour = proto.hours = getSetHour;
    proto.minute = proto.minutes = getSetMinute;
    proto.second = proto.seconds = getSetSecond;
    proto.millisecond = proto.milliseconds = getSetMillisecond;
    proto.utcOffset            = getSetOffset;
    proto.utc                  = setOffsetToUTC;
    proto.local                = setOffsetToLocal;
    proto.parseZone            = setOffsetToParsedOffset;
    proto.hasAlignedHourOffset = hasAlignedHourOffset;
    proto.isDST                = isDaylightSavingTime;
    proto.isLocal              = isLocal;
    proto.isUtcOffset          = isUtcOffset;
    proto.isUtc                = isUtc;
    proto.isUTC                = isUtc;
    proto.zoneAbbr = getZoneAbbr;
    proto.zoneName = getZoneName;
    proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
    proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
    proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
    proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. http://momentjs.com/guides/#/warnings/zone/', getSetZone);
    proto.isDSTShifted = deprecate('isDSTShifted is deprecated. See http://momentjs.com/guides/#/warnings/dst-shifted/ for more information', isDaylightSavingTimeShifted);

    function createUnix (input) {
        return createLocal(input * 1000);
    }

    function createInZone () {
        return createLocal.apply(null, arguments).parseZone();
    }

    function preParsePostFormat (string) {
        return string;
    }

    var proto$1 = Locale.prototype;

    proto$1.calendar        = calendar;
    proto$1.longDateFormat  = longDateFormat;
    proto$1.invalidDate     = invalidDate;
    proto$1.ordinal         = ordinal;
    proto$1.preparse        = preParsePostFormat;
    proto$1.postformat      = preParsePostFormat;
    proto$1.relativeTime    = relativeTime;
    proto$1.pastFuture      = pastFuture;
    proto$1.set             = set;

    proto$1.months            =        localeMonths;
    proto$1.monthsShort       =        localeMonthsShort;
    proto$1.monthsParse       =        localeMonthsParse;
    proto$1.monthsRegex       = monthsRegex;
    proto$1.monthsShortRegex  = monthsShortRegex;
    proto$1.week = localeWeek;
    proto$1.firstDayOfYear = localeFirstDayOfYear;
    proto$1.firstDayOfWeek = localeFirstDayOfWeek;

    proto$1.weekdays       =        localeWeekdays;
    proto$1.weekdaysMin    =        localeWeekdaysMin;
    proto$1.weekdaysShort  =        localeWeekdaysShort;
    proto$1.weekdaysParse  =        localeWeekdaysParse;

    proto$1.weekdaysRegex       =        weekdaysRegex;
    proto$1.weekdaysShortRegex  =        weekdaysShortRegex;
    proto$1.weekdaysMinRegex    =        weekdaysMinRegex;

    proto$1.isPM = localeIsPM;
    proto$1.meridiem = localeMeridiem;

    function get$1 (format, index, field, setter) {
        var locale = getLocale();
        var utc = createUTC().set(setter, index);
        return locale[field](utc, format);
    }

    function listMonthsImpl (format, index, field) {
        if (isNumber(format)) {
            index = format;
            format = undefined;
        }

        format = format || '';

        if (index != null) {
            return get$1(format, index, field, 'month');
        }

        var i;
        var out = [];
        for (i = 0; i < 12; i++) {
            out[i] = get$1(format, i, field, 'month');
        }
        return out;
    }

    // ()
    // (5)
    // (fmt, 5)
    // (fmt)
    // (true)
    // (true, 5)
    // (true, fmt, 5)
    // (true, fmt)
    function listWeekdaysImpl (localeSorted, format, index, field) {
        if (typeof localeSorted === 'boolean') {
            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        } else {
            format = localeSorted;
            index = format;
            localeSorted = false;

            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        }

        var locale = getLocale(),
            shift = localeSorted ? locale._week.dow : 0;

        if (index != null) {
            return get$1(format, (index + shift) % 7, field, 'day');
        }

        var i;
        var out = [];
        for (i = 0; i < 7; i++) {
            out[i] = get$1(format, (i + shift) % 7, field, 'day');
        }
        return out;
    }

    function listMonths (format, index) {
        return listMonthsImpl(format, index, 'months');
    }

    function listMonthsShort (format, index) {
        return listMonthsImpl(format, index, 'monthsShort');
    }

    function listWeekdays (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
    }

    function listWeekdaysShort (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
    }

    function listWeekdaysMin (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
    }

    getSetGlobalLocale('en', {
        dayOfMonthOrdinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    // Side effect imports

    hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', getSetGlobalLocale);
    hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', getLocale);

    var mathAbs = Math.abs;

    function abs () {
        var data           = this._data;

        this._milliseconds = mathAbs(this._milliseconds);
        this._days         = mathAbs(this._days);
        this._months       = mathAbs(this._months);

        data.milliseconds  = mathAbs(data.milliseconds);
        data.seconds       = mathAbs(data.seconds);
        data.minutes       = mathAbs(data.minutes);
        data.hours         = mathAbs(data.hours);
        data.months        = mathAbs(data.months);
        data.years         = mathAbs(data.years);

        return this;
    }

    function addSubtract$1 (duration, input, value, direction) {
        var other = createDuration(input, value);

        duration._milliseconds += direction * other._milliseconds;
        duration._days         += direction * other._days;
        duration._months       += direction * other._months;

        return duration._bubble();
    }

    // supports only 2.0-style add(1, 's') or add(duration)
    function add$1 (input, value) {
        return addSubtract$1(this, input, value, 1);
    }

    // supports only 2.0-style subtract(1, 's') or subtract(duration)
    function subtract$1 (input, value) {
        return addSubtract$1(this, input, value, -1);
    }

    function absCeil (number) {
        if (number < 0) {
            return Math.floor(number);
        } else {
            return Math.ceil(number);
        }
    }

    function bubble () {
        var milliseconds = this._milliseconds;
        var days         = this._days;
        var months       = this._months;
        var data         = this._data;
        var seconds, minutes, hours, years, monthsFromDays;

        // if we have a mix of positive and negative values, bubble down first
        // check: https://github.com/moment/moment/issues/2166
        if (!((milliseconds >= 0 && days >= 0 && months >= 0) ||
                (milliseconds <= 0 && days <= 0 && months <= 0))) {
            milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
            days = 0;
            months = 0;
        }

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;

        seconds           = absFloor(milliseconds / 1000);
        data.seconds      = seconds % 60;

        minutes           = absFloor(seconds / 60);
        data.minutes      = minutes % 60;

        hours             = absFloor(minutes / 60);
        data.hours        = hours % 24;

        days += absFloor(hours / 24);

        // convert days to months
        monthsFromDays = absFloor(daysToMonths(days));
        months += monthsFromDays;
        days -= absCeil(monthsToDays(monthsFromDays));

        // 12 months -> 1 year
        years = absFloor(months / 12);
        months %= 12;

        data.days   = days;
        data.months = months;
        data.years  = years;

        return this;
    }

    function daysToMonths (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        // 400 years have 12 months === 4800
        return days * 4800 / 146097;
    }

    function monthsToDays (months) {
        // the reverse of daysToMonths
        return months * 146097 / 4800;
    }

    function as (units) {
        if (!this.isValid()) {
            return NaN;
        }
        var days;
        var months;
        var milliseconds = this._milliseconds;

        units = normalizeUnits(units);

        if (units === 'month' || units === 'quarter' || units === 'year') {
            days = this._days + milliseconds / 864e5;
            months = this._months + daysToMonths(days);
            switch (units) {
                case 'month':   return months;
                case 'quarter': return months / 3;
                case 'year':    return months / 12;
            }
        } else {
            // handle milliseconds separately because of floating point math errors (issue #1867)
            days = this._days + Math.round(monthsToDays(this._months));
            switch (units) {
                case 'week'   : return days / 7     + milliseconds / 6048e5;
                case 'day'    : return days         + milliseconds / 864e5;
                case 'hour'   : return days * 24    + milliseconds / 36e5;
                case 'minute' : return days * 1440  + milliseconds / 6e4;
                case 'second' : return days * 86400 + milliseconds / 1000;
                // Math.floor prevents floating point math errors here
                case 'millisecond': return Math.floor(days * 864e5) + milliseconds;
                default: throw new Error('Unknown unit ' + units);
            }
        }
    }

    // TODO: Use this.as('ms')?
    function valueOf$1 () {
        if (!this.isValid()) {
            return NaN;
        }
        return (
            this._milliseconds +
            this._days * 864e5 +
            (this._months % 12) * 2592e6 +
            toInt(this._months / 12) * 31536e6
        );
    }

    function makeAs (alias) {
        return function () {
            return this.as(alias);
        };
    }

    var asMilliseconds = makeAs('ms');
    var asSeconds      = makeAs('s');
    var asMinutes      = makeAs('m');
    var asHours        = makeAs('h');
    var asDays         = makeAs('d');
    var asWeeks        = makeAs('w');
    var asMonths       = makeAs('M');
    var asQuarters     = makeAs('Q');
    var asYears        = makeAs('y');

    function clone$1 () {
        return createDuration(this);
    }

    function get$2 (units) {
        units = normalizeUnits(units);
        return this.isValid() ? this[units + 's']() : NaN;
    }

    function makeGetter(name) {
        return function () {
            return this.isValid() ? this._data[name] : NaN;
        };
    }

    var milliseconds = makeGetter('milliseconds');
    var seconds      = makeGetter('seconds');
    var minutes      = makeGetter('minutes');
    var hours        = makeGetter('hours');
    var days         = makeGetter('days');
    var months       = makeGetter('months');
    var years        = makeGetter('years');

    function weeks () {
        return absFloor(this.days() / 7);
    }

    var round = Math.round;
    var thresholds = {
        ss: 44,         // a few seconds to seconds
        s : 45,         // seconds to minute
        m : 45,         // minutes to hour
        h : 22,         // hours to day
        d : 26,         // days to month
        M : 11          // months to year
    };

    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime$1 (posNegDuration, withoutSuffix, locale) {
        var duration = createDuration(posNegDuration).abs();
        var seconds  = round(duration.as('s'));
        var minutes  = round(duration.as('m'));
        var hours    = round(duration.as('h'));
        var days     = round(duration.as('d'));
        var months   = round(duration.as('M'));
        var years    = round(duration.as('y'));

        var a = seconds <= thresholds.ss && ['s', seconds]  ||
                seconds < thresholds.s   && ['ss', seconds] ||
                minutes <= 1             && ['m']           ||
                minutes < thresholds.m   && ['mm', minutes] ||
                hours   <= 1             && ['h']           ||
                hours   < thresholds.h   && ['hh', hours]   ||
                days    <= 1             && ['d']           ||
                days    < thresholds.d   && ['dd', days]    ||
                months  <= 1             && ['M']           ||
                months  < thresholds.M   && ['MM', months]  ||
                years   <= 1             && ['y']           || ['yy', years];

        a[2] = withoutSuffix;
        a[3] = +posNegDuration > 0;
        a[4] = locale;
        return substituteTimeAgo.apply(null, a);
    }

    // This function allows you to set the rounding function for relative time strings
    function getSetRelativeTimeRounding (roundingFunction) {
        if (roundingFunction === undefined) {
            return round;
        }
        if (typeof(roundingFunction) === 'function') {
            round = roundingFunction;
            return true;
        }
        return false;
    }

    // This function allows you to set a threshold for relative time strings
    function getSetRelativeTimeThreshold (threshold, limit) {
        if (thresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return thresholds[threshold];
        }
        thresholds[threshold] = limit;
        if (threshold === 's') {
            thresholds.ss = limit - 1;
        }
        return true;
    }

    function humanize (withSuffix) {
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var locale = this.localeData();
        var output = relativeTime$1(this, !withSuffix, locale);

        if (withSuffix) {
            output = locale.pastFuture(+this, output);
        }

        return locale.postformat(output);
    }

    var abs$1 = Math.abs;

    function sign(x) {
        return ((x > 0) - (x < 0)) || +x;
    }

    function toISOString$1() {
        // for ISO strings we do not use the normal bubbling rules:
        //  * milliseconds bubble up until they become hours
        //  * days do not bubble at all
        //  * months bubble up until they become years
        // This is because there is no context-free conversion between hours and days
        // (think of clock changes)
        // and also not between days and months (28-31 days per month)
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var seconds = abs$1(this._milliseconds) / 1000;
        var days         = abs$1(this._days);
        var months       = abs$1(this._months);
        var minutes, hours, years;

        // 3600 seconds -> 60 minutes -> 1 hour
        minutes           = absFloor(seconds / 60);
        hours             = absFloor(minutes / 60);
        seconds %= 60;
        minutes %= 60;

        // 12 months -> 1 year
        years  = absFloor(months / 12);
        months %= 12;


        // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
        var Y = years;
        var M = months;
        var D = days;
        var h = hours;
        var m = minutes;
        var s = seconds ? seconds.toFixed(3).replace(/\.?0+$/, '') : '';
        var total = this.asSeconds();

        if (!total) {
            // this is the same as C#'s (Noda) and python (isodate)...
            // but not other JS (goog.date)
            return 'P0D';
        }

        var totalSign = total < 0 ? '-' : '';
        var ymSign = sign(this._months) !== sign(total) ? '-' : '';
        var daysSign = sign(this._days) !== sign(total) ? '-' : '';
        var hmsSign = sign(this._milliseconds) !== sign(total) ? '-' : '';

        return totalSign + 'P' +
            (Y ? ymSign + Y + 'Y' : '') +
            (M ? ymSign + M + 'M' : '') +
            (D ? daysSign + D + 'D' : '') +
            ((h || m || s) ? 'T' : '') +
            (h ? hmsSign + h + 'H' : '') +
            (m ? hmsSign + m + 'M' : '') +
            (s ? hmsSign + s + 'S' : '');
    }

    var proto$2 = Duration.prototype;

    proto$2.isValid        = isValid$1;
    proto$2.abs            = abs;
    proto$2.add            = add$1;
    proto$2.subtract       = subtract$1;
    proto$2.as             = as;
    proto$2.asMilliseconds = asMilliseconds;
    proto$2.asSeconds      = asSeconds;
    proto$2.asMinutes      = asMinutes;
    proto$2.asHours        = asHours;
    proto$2.asDays         = asDays;
    proto$2.asWeeks        = asWeeks;
    proto$2.asMonths       = asMonths;
    proto$2.asQuarters     = asQuarters;
    proto$2.asYears        = asYears;
    proto$2.valueOf        = valueOf$1;
    proto$2._bubble        = bubble;
    proto$2.clone          = clone$1;
    proto$2.get            = get$2;
    proto$2.milliseconds   = milliseconds;
    proto$2.seconds        = seconds;
    proto$2.minutes        = minutes;
    proto$2.hours          = hours;
    proto$2.days           = days;
    proto$2.weeks          = weeks;
    proto$2.months         = months;
    proto$2.years          = years;
    proto$2.humanize       = humanize;
    proto$2.toISOString    = toISOString$1;
    proto$2.toString       = toISOString$1;
    proto$2.toJSON         = toISOString$1;
    proto$2.locale         = locale;
    proto$2.localeData     = localeData;

    proto$2.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', toISOString$1);
    proto$2.lang = lang;

    // Side effect imports

    // FORMATTING

    addFormatToken('X', 0, 0, 'unix');
    addFormatToken('x', 0, 0, 'valueOf');

    // PARSING

    addRegexToken('x', matchSigned);
    addRegexToken('X', matchTimestamp);
    addParseToken('X', function (input, array, config) {
        config._d = new Date(parseFloat(input, 10) * 1000);
    });
    addParseToken('x', function (input, array, config) {
        config._d = new Date(toInt(input));
    });

    // Side effect imports


    hooks.version = '2.24.0';

    setHookCallback(createLocal);

    hooks.fn                    = proto;
    hooks.min                   = min;
    hooks.max                   = max;
    hooks.now                   = now;
    hooks.utc                   = createUTC;
    hooks.unix                  = createUnix;
    hooks.months                = listMonths;
    hooks.isDate                = isDate;
    hooks.locale                = getSetGlobalLocale;
    hooks.invalid               = createInvalid;
    hooks.duration              = createDuration;
    hooks.isMoment              = isMoment;
    hooks.weekdays              = listWeekdays;
    hooks.parseZone             = createInZone;
    hooks.localeData            = getLocale;
    hooks.isDuration            = isDuration;
    hooks.monthsShort           = listMonthsShort;
    hooks.weekdaysMin           = listWeekdaysMin;
    hooks.defineLocale          = defineLocale;
    hooks.updateLocale          = updateLocale;
    hooks.locales               = listLocales;
    hooks.weekdaysShort         = listWeekdaysShort;
    hooks.normalizeUnits        = normalizeUnits;
    hooks.relativeTimeRounding  = getSetRelativeTimeRounding;
    hooks.relativeTimeThreshold = getSetRelativeTimeThreshold;
    hooks.calendarFormat        = getCalendarFormat;
    hooks.prototype             = proto;

    // currently HTML5 input type only supports 24-hour formats
    hooks.HTML5_FMT = {
        DATETIME_LOCAL: 'YYYY-MM-DDTHH:mm',             // <input type="datetime-local" />
        DATETIME_LOCAL_SECONDS: 'YYYY-MM-DDTHH:mm:ss',  // <input type="datetime-local" step="1" />
        DATETIME_LOCAL_MS: 'YYYY-MM-DDTHH:mm:ss.SSS',   // <input type="datetime-local" step="0.001" />
        DATE: 'YYYY-MM-DD',                             // <input type="date" />
        TIME: 'HH:mm',                                  // <input type="time" />
        TIME_SECONDS: 'HH:mm:ss',                       // <input type="time" step="1" />
        TIME_MS: 'HH:mm:ss.SSS',                        // <input type="time" step="0.001" />
        WEEK: 'GGGG-[W]WW',                             // <input type="week" />
        MONTH: 'YYYY-MM'                                // <input type="month" />
    };

    return hooks;

})));
//! moment-timezone.js
//! version : 0.5.25
//! Copyright (c) JS Foundation and other contributors
//! license : MIT
//! github.com/moment/moment-timezone

(function (root, factory) {
	"use strict";

	/*global define*/
	if (typeof module === 'object' && module.exports) {
		module.exports = factory(require('moment')); // Node
	} else if (typeof define === 'function' && define.amd) {
		define(['moment'], factory);                 // AMD
	} else {
		factory(root.moment);                        // Browser
	}
}(this, function (moment) {
	"use strict";

	// Do not load moment-timezone a second time.
	// if (moment.tz !== undefined) {
	// 	logError('Moment Timezone ' + moment.tz.version + ' was already loaded ' + (moment.tz.dataVersion ? 'with data from ' : 'without any data') + moment.tz.dataVersion);
	// 	return moment;
	// }

	var VERSION = "0.5.25",
		zones = {},
		links = {},
		names = {},
		guesses = {},
		cachedGuess;

	if (!moment || typeof moment.version !== 'string') {
		logError('Moment Timezone requires Moment.js. See https://momentjs.com/timezone/docs/#/use-it/browser/');
	}

	var momentVersion = moment.version.split('.'),
		major = +momentVersion[0],
		minor = +momentVersion[1];

	// Moment.js version check
	if (major < 2 || (major === 2 && minor < 6)) {
		logError('Moment Timezone requires Moment.js >= 2.6.0. You are using Moment.js ' + moment.version + '. See momentjs.com');
	}

	/************************************
		Unpacking
	************************************/

	function charCodeToInt(charCode) {
		if (charCode > 96) {
			return charCode - 87;
		} else if (charCode > 64) {
			return charCode - 29;
		}
		return charCode - 48;
	}

	function unpackBase60(string) {
		var i = 0,
			parts = string.split('.'),
			whole = parts[0],
			fractional = parts[1] || '',
			multiplier = 1,
			num,
			out = 0,
			sign = 1;

		// handle negative numbers
		if (string.charCodeAt(0) === 45) {
			i = 1;
			sign = -1;
		}

		// handle digits before the decimal
		for (i; i < whole.length; i++) {
			num = charCodeToInt(whole.charCodeAt(i));
			out = 60 * out + num;
		}

		// handle digits after the decimal
		for (i = 0; i < fractional.length; i++) {
			multiplier = multiplier / 60;
			num = charCodeToInt(fractional.charCodeAt(i));
			out += num * multiplier;
		}

		return out * sign;
	}

	function arrayToInt (array) {
		for (var i = 0; i < array.length; i++) {
			array[i] = unpackBase60(array[i]);
		}
	}

	function intToUntil (array, length) {
		for (var i = 0; i < length; i++) {
			array[i] = Math.round((array[i - 1] || 0) + (array[i] * 60000)); // minutes to milliseconds
		}

		array[length - 1] = Infinity;
	}

	function mapIndices (source, indices) {
		var out = [], i;

		for (i = 0; i < indices.length; i++) {
			out[i] = source[indices[i]];
		}

		return out;
	}

	function unpack (string) {
		var data = string.split('|'),
			offsets = data[2].split(' '),
			indices = data[3].split(''),
			untils  = data[4].split(' ');

		arrayToInt(offsets);
		arrayToInt(indices);
		arrayToInt(untils);

		intToUntil(untils, indices.length);

		return {
			name       : data[0],
			abbrs      : mapIndices(data[1].split(' '), indices),
			offsets    : mapIndices(offsets, indices),
			untils     : untils,
			population : data[5] | 0
		};
	}

	/************************************
		Zone object
	************************************/

	function Zone (packedString) {
		if (packedString) {
			this._set(unpack(packedString));
		}
	}

	Zone.prototype = {
		_set : function (unpacked) {
			this.name       = unpacked.name;
			this.abbrs      = unpacked.abbrs;
			this.untils     = unpacked.untils;
			this.offsets    = unpacked.offsets;
			this.population = unpacked.population;
		},

		_index : function (timestamp) {
			var target = +timestamp,
				untils = this.untils,
				i;

			for (i = 0; i < untils.length; i++) {
				if (target < untils[i]) {
					return i;
				}
			}
		},

		parse : function (timestamp) {
			var target  = +timestamp,
				offsets = this.offsets,
				untils  = this.untils,
				max     = untils.length - 1,
				offset, offsetNext, offsetPrev, i;

			for (i = 0; i < max; i++) {
				offset     = offsets[i];
				offsetNext = offsets[i + 1];
				offsetPrev = offsets[i ? i - 1 : i];

				if (offset < offsetNext && tz.moveAmbiguousForward) {
					offset = offsetNext;
				} else if (offset > offsetPrev && tz.moveInvalidForward) {
					offset = offsetPrev;
				}

				if (target < untils[i] - (offset * 60000)) {
					return offsets[i];
				}
			}

			return offsets[max];
		},

		abbr : function (mom) {
			return this.abbrs[this._index(mom)];
		},

		offset : function (mom) {
			logError("zone.offset has been deprecated in favor of zone.utcOffset");
			return this.offsets[this._index(mom)];
		},

		utcOffset : function (mom) {
			return this.offsets[this._index(mom)];
		}
	};

	/************************************
		Current Timezone
	************************************/

	function OffsetAt(at) {
		var timeString = at.toTimeString();
		var abbr = timeString.match(/\([a-z ]+\)/i);
		if (abbr && abbr[0]) {
			// 17:56:31 GMT-0600 (CST)
			// 17:56:31 GMT-0600 (Central Standard Time)
			abbr = abbr[0].match(/[A-Z]/g);
			abbr = abbr ? abbr.join('') : undefined;
		} else {
			// 17:56:31 CST
			// 17:56:31 GMT+0800 (台北標準時間)
			abbr = timeString.match(/[A-Z]{3,5}/g);
			abbr = abbr ? abbr[0] : undefined;
		}

		if (abbr === 'GMT') {
			abbr = undefined;
		}

		this.at = +at;
		this.abbr = abbr;
		this.offset = at.getTimezoneOffset();
	}

	function ZoneScore(zone) {
		this.zone = zone;
		this.offsetScore = 0;
		this.abbrScore = 0;
	}

	ZoneScore.prototype.scoreOffsetAt = function (offsetAt) {
		this.offsetScore += Math.abs(this.zone.utcOffset(offsetAt.at) - offsetAt.offset);
		if (this.zone.abbr(offsetAt.at).replace(/[^A-Z]/g, '') !== offsetAt.abbr) {
			this.abbrScore++;
		}
	};

	function findChange(low, high) {
		var mid, diff;

		while ((diff = ((high.at - low.at) / 12e4 | 0) * 6e4)) {
			mid = new OffsetAt(new Date(low.at + diff));
			if (mid.offset === low.offset) {
				low = mid;
			} else {
				high = mid;
			}
		}

		return low;
	}

	function userOffsets() {
		var startYear = new Date().getFullYear() - 2,
			last = new OffsetAt(new Date(startYear, 0, 1)),
			offsets = [last],
			change, next, i;

		for (i = 1; i < 48; i++) {
			next = new OffsetAt(new Date(startYear, i, 1));
			if (next.offset !== last.offset) {
				change = findChange(last, next);
				offsets.push(change);
				offsets.push(new OffsetAt(new Date(change.at + 6e4)));
			}
			last = next;
		}

		for (i = 0; i < 4; i++) {
			offsets.push(new OffsetAt(new Date(startYear + i, 0, 1)));
			offsets.push(new OffsetAt(new Date(startYear + i, 6, 1)));
		}

		return offsets;
	}

	function sortZoneScores (a, b) {
		if (a.offsetScore !== b.offsetScore) {
			return a.offsetScore - b.offsetScore;
		}
		if (a.abbrScore !== b.abbrScore) {
			return a.abbrScore - b.abbrScore;
		}
		return b.zone.population - a.zone.population;
	}

	function addToGuesses (name, offsets) {
		var i, offset;
		arrayToInt(offsets);
		for (i = 0; i < offsets.length; i++) {
			offset = offsets[i];
			guesses[offset] = guesses[offset] || {};
			guesses[offset][name] = true;
		}
	}

	function guessesForUserOffsets (offsets) {
		var offsetsLength = offsets.length,
			filteredGuesses = {},
			out = [],
			i, j, guessesOffset;

		for (i = 0; i < offsetsLength; i++) {
			guessesOffset = guesses[offsets[i].offset] || {};
			for (j in guessesOffset) {
				if (guessesOffset.hasOwnProperty(j)) {
					filteredGuesses[j] = true;
				}
			}
		}

		for (i in filteredGuesses) {
			if (filteredGuesses.hasOwnProperty(i)) {
				out.push(names[i]);
			}
		}

		return out;
	}

	function rebuildGuess () {

		// use Intl API when available and returning valid time zone
		try {
			var intlName = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (intlName && intlName.length > 3) {
				var name = names[normalizeName(intlName)];
				if (name) {
					return name;
				}
				logError("Moment Timezone found " + intlName + " from the Intl api, but did not have that data loaded.");
			}
		} catch (e) {
			// Intl unavailable, fall back to manual guessing.
		}

		var offsets = userOffsets(),
			offsetsLength = offsets.length,
			guesses = guessesForUserOffsets(offsets),
			zoneScores = [],
			zoneScore, i, j;

		for (i = 0; i < guesses.length; i++) {
			zoneScore = new ZoneScore(getZone(guesses[i]), offsetsLength);
			for (j = 0; j < offsetsLength; j++) {
				zoneScore.scoreOffsetAt(offsets[j]);
			}
			zoneScores.push(zoneScore);
		}

		zoneScores.sort(sortZoneScores);

		return zoneScores.length > 0 ? zoneScores[0].zone.name : undefined;
	}

	function guess (ignoreCache) {
		if (!cachedGuess || ignoreCache) {
			cachedGuess = rebuildGuess();
		}
		return cachedGuess;
	}

	/************************************
		Global Methods
	************************************/

	function normalizeName (name) {
		return (name || '').toLowerCase().replace(/\//g, '_');
	}

	function addZone (packed) {
		var i, name, split, normalized;

		if (typeof packed === "string") {
			packed = [packed];
		}

		for (i = 0; i < packed.length; i++) {
			split = packed[i].split('|');
			name = split[0];
			normalized = normalizeName(name);
			zones[normalized] = packed[i];
			names[normalized] = name;
			addToGuesses(normalized, split[2].split(' '));
		}
	}

	function getZone (name, caller) {
		
		name = normalizeName(name);

		var zone = zones[name];
		var link;

		if (zone instanceof Zone) {
			return zone;
		}

		if (typeof zone === 'string') {
			zone = new Zone(zone);
			zones[name] = zone;
			return zone;
		}

		// Pass getZone to prevent recursion more than 1 level deep
		if (links[name] && caller !== getZone && (link = getZone(links[name], getZone))) {
			zone = zones[name] = new Zone();
			zone._set(link);
			zone.name = names[name];
			return zone;
		}

		return null;
	}

	function getNames () {
		var i, out = [];

		for (i in names) {
			if (names.hasOwnProperty(i) && (zones[i] || zones[links[i]]) && names[i]) {
				out.push(names[i]);
			}
		}

		return out.sort();
	}

	function addLink (aliases) {
		var i, alias, normal0, normal1;

		if (typeof aliases === "string") {
			aliases = [aliases];
		}

		for (i = 0; i < aliases.length; i++) {
			alias = aliases[i].split('|');

			normal0 = normalizeName(alias[0]);
			normal1 = normalizeName(alias[1]);

			links[normal0] = normal1;
			names[normal0] = alias[0];

			links[normal1] = normal0;
			names[normal1] = alias[1];
		}
	}

	function loadData (data) {
		addZone(data.zones);
		addLink(data.links);
		tz.dataVersion = data.version;
	}

	function zoneExists (name) {
		if (!zoneExists.didShowError) {
			zoneExists.didShowError = true;
				logError("moment.tz.zoneExists('" + name + "') has been deprecated in favor of !moment.tz.zone('" + name + "')");
		}
		return !!getZone(name);
	}

	function needsOffset (m) {
		var isUnixTimestamp = (m._f === 'X' || m._f === 'x');
		return !!(m._a && (m._tzm === undefined) && !isUnixTimestamp);
	}

	function logError (message) {
		if (typeof console !== 'undefined' && typeof console.error === 'function') {
			console.error(message);
		}
	}

	/************************************
		moment.tz namespace
	************************************/

	function tz (input) {
		var args = Array.prototype.slice.call(arguments, 0, -1),
			name = arguments[arguments.length - 1],
			zone = getZone(name),
			out  = moment.utc.apply(null, args);

		if (zone && !moment.isMoment(input) && needsOffset(out)) {
			out.add(zone.parse(out), 'minutes');
		}

		out.tz(name);

		return out;
	}

	tz.version      = VERSION;
	tz.dataVersion  = '';
	tz._zones       = zones;
	tz._links       = links;
	tz._names       = names;
	tz.add          = addZone;
	tz.link         = addLink;
	tz.load         = loadData;
	tz.zone         = getZone;
	tz.zoneExists   = zoneExists; // deprecated in 0.1.0
	tz.guess        = guess;
	tz.names        = getNames;
	tz.Zone         = Zone;
	tz.unpack       = unpack;
	tz.unpackBase60 = unpackBase60;
	tz.needsOffset  = needsOffset;
	tz.moveInvalidForward   = true;
	tz.moveAmbiguousForward = false;

	/************************************
		Interface with Moment.js
	************************************/

	var fn = moment.fn;

	moment.tz = tz;

	moment.defaultZone = null;

	moment.updateOffset = function (mom, keepTime) {
		var zone = moment.defaultZone,
			offset;

		if (mom._z === undefined) {
			if (zone && needsOffset(mom) && !mom._isUTC) {
				mom._d = moment.utc(mom._a)._d;
				mom.utc().add(zone.parse(mom), 'minutes');
			}
			mom._z = zone;
		}
		if (mom._z) {
			offset = mom._z.utcOffset(mom);
			if (Math.abs(offset) < 16) {
				offset = offset / 60;
			}
			if (mom.utcOffset !== undefined) {
				var z = mom._z;
				mom.utcOffset(-offset, keepTime);
				mom._z = z;
			} else {
				mom.zone(offset, keepTime);
			}
		}
	};

	fn.tz = function (name, keepTime) {
		if (name) {
			if (typeof name !== 'string') {
				throw new Error('Time zone name must be a string, got ' + name + ' [' + typeof name + ']');
			}
			this._z = getZone(name);
			if (this._z) {
				moment.updateOffset(this, keepTime);
			} else {
				logError("Moment Timezone has no data for " + name + ". See http://momentjs.com/timezone/docs/#/data-loading/.");
			}
			return this;
		}
		if (this._z) { return this._z.name; }
	};

	function abbrWrap (old) {
		return function () {
			if (this._z) { return this._z.abbr(this); }
			return old.call(this);
		};
	}

	function resetZoneWrap (old) {
		return function () {
			this._z = null;
			return old.apply(this, arguments);
		};
	}

	function resetZoneWrap2 (old) {
		return function () {
			if (arguments.length > 0) this._z = null;
			return old.apply(this, arguments);
		};
	}

	fn.zoneName  = abbrWrap(fn.zoneName);
	fn.zoneAbbr  = abbrWrap(fn.zoneAbbr);
	fn.utc       = resetZoneWrap(fn.utc);
	fn.local     = resetZoneWrap(fn.local);
	fn.utcOffset = resetZoneWrap2(fn.utcOffset);
	
	moment.tz.setDefault = function(name) {
		if (major < 2 || (major === 2 && minor < 9)) {
			logError('Moment Timezone setDefault() requires Moment.js >= 2.9.0. You are using Moment.js ' + moment.version + '.');
		}
		moment.defaultZone = name ? getZone(name) : null;
		return moment;
	};

	// Cloning a moment should include the _z property.
	var momentProperties = moment.momentProperties;
	if (Object.prototype.toString.call(momentProperties) === '[object Array]') {
		// moment 2.8.1+
		momentProperties.push('_z');
		momentProperties.push('_a');
	} else if (momentProperties) {
		// moment 2.7.0
		momentProperties._z = null;
	}

	loadData({
		"version": "2019a",
		"zones": [
			"Africa/Abidjan|GMT|0|0||48e5",
			"Africa/Nairobi|EAT|-30|0||47e5",
			"Africa/Algiers|CET|-10|0||26e5",
			"Africa/Lagos|WAT|-10|0||17e6",
			"Africa/Maputo|CAT|-20|0||26e5",
			"Africa/Cairo|EET EEST|-20 -30|01010|1M2m0 gL0 e10 mn0|15e6",
			"Africa/Casablanca|+00 +01|0 -10|01010101010101010101010101010101|1LHC0 A00 e00 y00 11A0 uM0 e00 Dc0 11A0 s00 e00 IM0 WM0 mo0 gM0 LA0 WM0 jA0 e00 28M0 e00 2600 e00 28M0 e00 2600 gM0 2600 e00 28M0 e00|32e5",
			"Europe/Paris|CET CEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|11e6",
			"Africa/Johannesburg|SAST|-20|0||84e5",
			"Africa/Khartoum|EAT CAT|-30 -20|01|1Usl0|51e5",
			"Africa/Sao_Tome|GMT WAT|0 -10|010|1UQN0 2q00",
			"Africa/Tripoli|EET|-20|0||11e5",
			"Africa/Windhoek|CAT WAT|-20 -10|010101010|1LKo0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0|32e4",
			"America/Adak|HST HDT|a0 90|01010101010101010101010|1Lzo0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|326",
			"America/Anchorage|AKST AKDT|90 80|01010101010101010101010|1Lzn0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|30e4",
			"America/Santo_Domingo|AST|40|0||29e5",
			"America/Fortaleza|-03|30|0||34e5",
			"America/Asuncion|-03 -04|30 40|01010101010101010101010|1LEP0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1ip0|28e5",
			"America/Panama|EST|50|0||15e5",
			"America/Mexico_City|CST CDT|60 50|01010101010101010101010|1LKw0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|20e6",
			"America/Managua|CST|60|0||22e5",
			"America/La_Paz|-04|40|0||19e5",
			"America/Lima|-05|50|0||11e6",
			"America/Denver|MST MDT|70 60|01010101010101010101010|1Lzl0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|26e5",
			"America/Campo_Grande|-03 -04|30 40|01010101010101010101010|1LqP0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|77e4",
			"America/Cancun|CST CDT EST|60 50 50|0102|1LKw0 1lb0 Dd0|63e4",
			"America/Caracas|-0430 -04|4u 40|01|1QMT0|29e5",
			"America/Chicago|CST CDT|60 50|01010101010101010101010|1Lzk0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|92e5",
			"America/Chihuahua|MST MDT|70 60|01010101010101010101010|1LKx0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|81e4",
			"America/Phoenix|MST|70|0||42e5",
			"America/Los_Angeles|PST PDT|80 70|01010101010101010101010|1Lzm0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|15e6",
			"America/New_York|EST EDT|50 40|01010101010101010101010|1Lzj0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|21e6",
			"America/Fort_Nelson|PST PDT MST|80 70 70|0102|1Lzm0 1zb0 Op0|39e2",
			"America/Halifax|AST ADT|40 30|01010101010101010101010|1Lzi0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|39e4",
			"America/Godthab|-03 -02|30 20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|17e3",
			"America/Grand_Turk|EST EDT AST|50 40 40|0101210101010101010|1Lzj0 1zb0 Op0 1zb0 5Ip0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|37e2",
			"America/Havana|CST CDT|50 40|01010101010101010101010|1Lzh0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0|21e5",
			"America/Metlakatla|PST AKST AKDT|80 90 80|012121201212121212121|1PAa0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 uM0 jB0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|14e2",
			"America/Miquelon|-03 -02|30 20|01010101010101010101010|1Lzh0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|61e2",
			"America/Montevideo|-02 -03|20 30|0101|1Lzg0 1o10 11z0|17e5",
			"America/Noronha|-02|20|0||30e2",
			"America/Port-au-Prince|EST EDT|50 40|010101010101010101010|1Lzj0 1zb0 Op0 1zb0 3iN0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e5",
			"Antarctica/Palmer|-03 -04|30 40|01010|1LSP0 Rd0 46n0 Ap0|40",
			"America/Santiago|-03 -04|30 40|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|62e5",
			"America/Sao_Paulo|-02 -03|20 30|01010101010101010101010|1LqO0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|20e6",
			"Atlantic/Azores|-01 +00|10 0|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|25e4",
			"America/St_Johns|NST NDT|3u 2u|01010101010101010101010|1Lzhu 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|11e4",
			"Antarctica/Casey|+08 +11|-80 -b0|010|1RWg0 3m10|10",
			"Asia/Bangkok|+07|-70|0||15e6",
			"Pacific/Port_Moresby|+10|-a0|0||25e4",
			"Pacific/Guadalcanal|+11|-b0|0||11e4",
			"Asia/Tashkent|+05|-50|0||23e5",
			"Pacific/Auckland|NZDT NZST|-d0 -c0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|14e5",
			"Asia/Baghdad|+03|-30|0||66e5",
			"Antarctica/Troll|+00 +02|0 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|40",
			"Asia/Dhaka|+06|-60|0||16e6",
			"Asia/Amman|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00|25e5",
			"Asia/Kamchatka|+12|-c0|0||18e4",
			"Asia/Baku|+04 +05|-40 -50|01010|1LHA0 1o00 11A0 1o00|27e5",
			"Asia/Barnaul|+07 +06|-70 -60|010|1N7v0 3rd0",
			"Asia/Beirut|EET EEST|-20 -30|01010101010101010101010|1LHy0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|22e5",
			"Asia/Kuala_Lumpur|+08|-80|0||71e5",
			"Asia/Kolkata|IST|-5u|0||15e6",
			"Asia/Chita|+10 +08 +09|-a0 -80 -90|012|1N7s0 3re0|33e4",
			"Asia/Ulaanbaatar|+08 +09|-80 -90|01010|1O8G0 1cJ0 1cP0 1cJ0|12e5",
			"Asia/Shanghai|CST|-80|0||23e6",
			"Asia/Colombo|+0530|-5u|0||22e5",
			"Asia/Damascus|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0|26e5",
			"Asia/Dili|+09|-90|0||19e4",
			"Asia/Dubai|+04|-40|0||39e5",
			"Asia/Famagusta|EET EEST +03|-20 -30 -30|0101012010101010101010|1LHB0 1o00 11A0 1o00 11A0 15U0 2Ks0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Asia/Gaza|EET EEST|-20 -30|01010101010101010101010|1LGK0 1nX0 1210 1nz0 1220 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|18e5",
			"Asia/Hong_Kong|HKT|-80|0||73e5",
			"Asia/Hovd|+07 +08|-70 -80|01010|1O8H0 1cJ0 1cP0 1cJ0|81e3",
			"Asia/Irkutsk|+09 +08|-90 -80|01|1N7t0|60e4",
			"Europe/Istanbul|EET EEST +03|-20 -30 -30|0101012|1LI10 1nA0 11A0 1tA0 U00 15w0|13e6",
			"Asia/Jakarta|WIB|-70|0||31e6",
			"Asia/Jayapura|WIT|-90|0||26e4",
			"Asia/Jerusalem|IST IDT|-20 -30|01010101010101010101010|1LGM0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0|81e4",
			"Asia/Kabul|+0430|-4u|0||46e5",
			"Asia/Karachi|PKT|-50|0||24e6",
			"Asia/Kathmandu|+0545|-5J|0||12e5",
			"Asia/Yakutsk|+10 +09|-a0 -90|01|1N7s0|28e4",
			"Asia/Krasnoyarsk|+08 +07|-80 -70|01|1N7u0|10e5",
			"Asia/Magadan|+12 +10 +11|-c0 -a0 -b0|012|1N7q0 3Cq0|95e3",
			"Asia/Makassar|WITA|-80|0||15e5",
			"Asia/Manila|PST|-80|0||24e6",
			"Europe/Athens|EET EEST|-20 -30|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|35e5",
			"Asia/Novosibirsk|+07 +06|-70 -60|010|1N7v0 4eN0|15e5",
			"Asia/Omsk|+07 +06|-70 -60|01|1N7v0|12e5",
			"Asia/Pyongyang|KST KST|-90 -8u|010|1P4D0 6BA0|29e5",
			"Asia/Qyzylorda|+06 +05|-60 -50|01|1Xei0|73e4",
			"Asia/Rangoon|+0630|-6u|0||48e5",
			"Asia/Sakhalin|+11 +10|-b0 -a0|010|1N7r0 3rd0|58e4",
			"Asia/Seoul|KST|-90|0||23e6",
			"Asia/Srednekolymsk|+12 +11|-c0 -b0|01|1N7q0|35e2",
			"Asia/Tehran|+0330 +0430|-3u -4u|01010101010101010101010|1LEku 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0|14e6",
			"Asia/Tokyo|JST|-90|0||38e6",
			"Asia/Tomsk|+07 +06|-70 -60|010|1N7v0 3Qp0|10e5",
			"Asia/Vladivostok|+11 +10|-b0 -a0|01|1N7r0|60e4",
			"Asia/Yekaterinburg|+06 +05|-60 -50|01|1N7w0|14e5",
			"Europe/Lisbon|WET WEST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|27e5",
			"Atlantic/Cape_Verde|-01|10|0||50e4",
			"Australia/Sydney|AEDT AEST|-b0 -a0|01010101010101010101010|1LKg0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|40e5",
			"Australia/Adelaide|ACDT ACST|-au -9u|01010101010101010101010|1LKgu 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|11e5",
			"Australia/Brisbane|AEST|-a0|0||20e5",
			"Australia/Darwin|ACST|-9u|0||12e4",
			"Australia/Eucla|+0845|-8J|0||368",
			"Australia/Lord_Howe|+11 +1030|-b0 -au|01010101010101010101010|1LKf0 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1fzu 1cMu|347",
			"Australia/Perth|AWST|-80|0||18e5",
			"Pacific/Easter|-05 -06|50 60|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|30e2",
			"Europe/Dublin|GMT IST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|12e5",
			"Etc/GMT-1|+01|-10|0|",
			"Pacific/Fakaofo|+13|-d0|0||483",
			"Pacific/Kiritimati|+14|-e0|0||51e2",
			"Etc/GMT-2|+02|-20|0|",
			"Pacific/Tahiti|-10|a0|0||18e4",
			"Pacific/Niue|-11|b0|0||12e2",
			"Etc/GMT+12|-12|c0|0|",
			"Pacific/Galapagos|-06|60|0||25e3",
			"Etc/GMT+7|-07|70|0|",
			"Pacific/Pitcairn|-08|80|0||56",
			"Pacific/Gambier|-09|90|0||125",
			"Etc/UTC|UTC|0|0|",
			"Europe/Ulyanovsk|+04 +03|-40 -30|010|1N7y0 3rd0|13e5",
			"Europe/London|GMT BST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|10e6",
			"Europe/Chisinau|EET EEST|-20 -30|01010101010101010101010|1LHA0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|67e4",
			"Europe/Kaliningrad|+03 EET|-30 -20|01|1N7z0|44e4",
			"Europe/Kirov|+04 +03|-40 -30|01|1N7y0|48e4",
			"Europe/Moscow|MSK MSK|-40 -30|01|1N7y0|16e6",
			"Europe/Saratov|+04 +03|-40 -30|010|1N7y0 5810",
			"Europe/Simferopol|EET MSK MSK|-20 -40 -30|012|1LHA0 1nW0|33e4",
			"Europe/Volgograd|+04 +03|-40 -30|010|1N7y0 9Jd0|10e5",
			"Pacific/Honolulu|HST|a0|0||37e4",
			"MET|MET MEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Pacific/Chatham|+1345 +1245|-dJ -cJ|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|600",
			"Pacific/Apia|+14 +13|-e0 -d0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|37e3",
			"Pacific/Bougainville|+10 +11|-a0 -b0|01|1NwE0|18e4",
			"Pacific/Fiji|+13 +12|-d0 -c0|01010101010101010101010|1Lfp0 1SN0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0|88e4",
			"Pacific/Guam|ChST|-a0|0||17e4",
			"Pacific/Marquesas|-0930|9u|0||86e2",
			"Pacific/Pago_Pago|SST|b0|0||37e2",
			"Pacific/Norfolk|+1130 +11|-bu -b0|01|1PoCu|25e4",
			"Pacific/Tongatapu|+13 +14|-d0 -e0|010|1S4d0 s00|75e3"
		],
		"links": [
			"Africa/Abidjan|Africa/Accra",
			"Africa/Abidjan|Africa/Bamako",
			"Africa/Abidjan|Africa/Banjul",
			"Africa/Abidjan|Africa/Bissau",
			"Africa/Abidjan|Africa/Conakry",
			"Africa/Abidjan|Africa/Dakar",
			"Africa/Abidjan|Africa/Freetown",
			"Africa/Abidjan|Africa/Lome",
			"Africa/Abidjan|Africa/Monrovia",
			"Africa/Abidjan|Africa/Nouakchott",
			"Africa/Abidjan|Africa/Ouagadougou",
			"Africa/Abidjan|Africa/Timbuktu",
			"Africa/Abidjan|America/Danmarkshavn",
			"Africa/Abidjan|Atlantic/Reykjavik",
			"Africa/Abidjan|Atlantic/St_Helena",
			"Africa/Abidjan|Etc/GMT",
			"Africa/Abidjan|Etc/GMT+0",
			"Africa/Abidjan|Etc/GMT-0",
			"Africa/Abidjan|Etc/GMT0",
			"Africa/Abidjan|Etc/Greenwich",
			"Africa/Abidjan|GMT",
			"Africa/Abidjan|GMT+0",
			"Africa/Abidjan|GMT-0",
			"Africa/Abidjan|GMT0",
			"Africa/Abidjan|Greenwich",
			"Africa/Abidjan|Iceland",
			"Africa/Algiers|Africa/Tunis",
			"Africa/Cairo|Egypt",
			"Africa/Casablanca|Africa/El_Aaiun",
			"Africa/Johannesburg|Africa/Maseru",
			"Africa/Johannesburg|Africa/Mbabane",
			"Africa/Lagos|Africa/Bangui",
			"Africa/Lagos|Africa/Brazzaville",
			"Africa/Lagos|Africa/Douala",
			"Africa/Lagos|Africa/Kinshasa",
			"Africa/Lagos|Africa/Libreville",
			"Africa/Lagos|Africa/Luanda",
			"Africa/Lagos|Africa/Malabo",
			"Africa/Lagos|Africa/Ndjamena",
			"Africa/Lagos|Africa/Niamey",
			"Africa/Lagos|Africa/Porto-Novo",
			"Africa/Maputo|Africa/Blantyre",
			"Africa/Maputo|Africa/Bujumbura",
			"Africa/Maputo|Africa/Gaborone",
			"Africa/Maputo|Africa/Harare",
			"Africa/Maputo|Africa/Kigali",
			"Africa/Maputo|Africa/Lubumbashi",
			"Africa/Maputo|Africa/Lusaka",
			"Africa/Nairobi|Africa/Addis_Ababa",
			"Africa/Nairobi|Africa/Asmara",
			"Africa/Nairobi|Africa/Asmera",
			"Africa/Nairobi|Africa/Dar_es_Salaam",
			"Africa/Nairobi|Africa/Djibouti",
			"Africa/Nairobi|Africa/Juba",
			"Africa/Nairobi|Africa/Kampala",
			"Africa/Nairobi|Africa/Mogadishu",
			"Africa/Nairobi|Indian/Antananarivo",
			"Africa/Nairobi|Indian/Comoro",
			"Africa/Nairobi|Indian/Mayotte",
			"Africa/Tripoli|Libya",
			"America/Adak|America/Atka",
			"America/Adak|US/Aleutian",
			"America/Anchorage|America/Juneau",
			"America/Anchorage|America/Nome",
			"America/Anchorage|America/Sitka",
			"America/Anchorage|America/Yakutat",
			"America/Anchorage|US/Alaska",
			"America/Campo_Grande|America/Cuiaba",
			"America/Chicago|America/Indiana/Knox",
			"America/Chicago|America/Indiana/Tell_City",
			"America/Chicago|America/Knox_IN",
			"America/Chicago|America/Matamoros",
			"America/Chicago|America/Menominee",
			"America/Chicago|America/North_Dakota/Beulah",
			"America/Chicago|America/North_Dakota/Center",
			"America/Chicago|America/North_Dakota/New_Salem",
			"America/Chicago|America/Rainy_River",
			"America/Chicago|America/Rankin_Inlet",
			"America/Chicago|America/Resolute",
			"America/Chicago|America/Winnipeg",
			"America/Chicago|CST6CDT",
			"America/Chicago|Canada/Central",
			"America/Chicago|US/Central",
			"America/Chicago|US/Indiana-Starke",
			"America/Chihuahua|America/Mazatlan",
			"America/Chihuahua|Mexico/BajaSur",
			"America/Denver|America/Boise",
			"America/Denver|America/Cambridge_Bay",
			"America/Denver|America/Edmonton",
			"America/Denver|America/Inuvik",
			"America/Denver|America/Ojinaga",
			"America/Denver|America/Shiprock",
			"America/Denver|America/Yellowknife",
			"America/Denver|Canada/Mountain",
			"America/Denver|MST7MDT",
			"America/Denver|Navajo",
			"America/Denver|US/Mountain",
			"America/Fortaleza|America/Araguaina",
			"America/Fortaleza|America/Argentina/Buenos_Aires",
			"America/Fortaleza|America/Argentina/Catamarca",
			"America/Fortaleza|America/Argentina/ComodRivadavia",
			"America/Fortaleza|America/Argentina/Cordoba",
			"America/Fortaleza|America/Argentina/Jujuy",
			"America/Fortaleza|America/Argentina/La_Rioja",
			"America/Fortaleza|America/Argentina/Mendoza",
			"America/Fortaleza|America/Argentina/Rio_Gallegos",
			"America/Fortaleza|America/Argentina/Salta",
			"America/Fortaleza|America/Argentina/San_Juan",
			"America/Fortaleza|America/Argentina/San_Luis",
			"America/Fortaleza|America/Argentina/Tucuman",
			"America/Fortaleza|America/Argentina/Ushuaia",
			"America/Fortaleza|America/Bahia",
			"America/Fortaleza|America/Belem",
			"America/Fortaleza|America/Buenos_Aires",
			"America/Fortaleza|America/Catamarca",
			"America/Fortaleza|America/Cayenne",
			"America/Fortaleza|America/Cordoba",
			"America/Fortaleza|America/Jujuy",
			"America/Fortaleza|America/Maceio",
			"America/Fortaleza|America/Mendoza",
			"America/Fortaleza|America/Paramaribo",
			"America/Fortaleza|America/Recife",
			"America/Fortaleza|America/Rosario",
			"America/Fortaleza|America/Santarem",
			"America/Fortaleza|Antarctica/Rothera",
			"America/Fortaleza|Atlantic/Stanley",
			"America/Fortaleza|Etc/GMT+3",
			"America/Halifax|America/Glace_Bay",
			"America/Halifax|America/Goose_Bay",
			"America/Halifax|America/Moncton",
			"America/Halifax|America/Thule",
			"America/Halifax|Atlantic/Bermuda",
			"America/Halifax|Canada/Atlantic",
			"America/Havana|Cuba",
			"America/La_Paz|America/Boa_Vista",
			"America/La_Paz|America/Guyana",
			"America/La_Paz|America/Manaus",
			"America/La_Paz|America/Porto_Velho",
			"America/La_Paz|Brazil/West",
			"America/La_Paz|Etc/GMT+4",
			"America/Lima|America/Bogota",
			"America/Lima|America/Eirunepe",
			"America/Lima|America/Guayaquil",
			"America/Lima|America/Porto_Acre",
			"America/Lima|America/Rio_Branco",
			"America/Lima|Brazil/Acre",
			"America/Lima|Etc/GMT+5",
			"America/Los_Angeles|America/Dawson",
			"America/Los_Angeles|America/Ensenada",
			"America/Los_Angeles|America/Santa_Isabel",
			"America/Los_Angeles|America/Tijuana",
			"America/Los_Angeles|America/Vancouver",
			"America/Los_Angeles|America/Whitehorse",
			"America/Los_Angeles|Canada/Pacific",
			"America/Los_Angeles|Canada/Yukon",
			"America/Los_Angeles|Mexico/BajaNorte",
			"America/Los_Angeles|PST8PDT",
			"America/Los_Angeles|US/Pacific",
			"America/Los_Angeles|US/Pacific-New",
			"America/Managua|America/Belize",
			"America/Managua|America/Costa_Rica",
			"America/Managua|America/El_Salvador",
			"America/Managua|America/Guatemala",
			"America/Managua|America/Regina",
			"America/Managua|America/Swift_Current",
			"America/Managua|America/Tegucigalpa",
			"America/Managua|Canada/Saskatchewan",
			"America/Mexico_City|America/Bahia_Banderas",
			"America/Mexico_City|America/Merida",
			"America/Mexico_City|America/Monterrey",
			"America/Mexico_City|Mexico/General",
			"America/New_York|America/Detroit",
			"America/New_York|America/Fort_Wayne",
			"America/New_York|America/Indiana/Indianapolis",
			"America/New_York|America/Indiana/Marengo",
			"America/New_York|America/Indiana/Petersburg",
			"America/New_York|America/Indiana/Vevay",
			"America/New_York|America/Indiana/Vincennes",
			"America/New_York|America/Indiana/Winamac",
			"America/New_York|America/Indianapolis",
			"America/New_York|America/Iqaluit",
			"America/New_York|America/Kentucky/Louisville",
			"America/New_York|America/Kentucky/Monticello",
			"America/New_York|America/Louisville",
			"America/New_York|America/Montreal",
			"America/New_York|America/Nassau",
			"America/New_York|America/Nipigon",
			"America/New_York|America/Pangnirtung",
			"America/New_York|America/Thunder_Bay",
			"America/New_York|America/Toronto",
			"America/New_York|Canada/Eastern",
			"America/New_York|EST5EDT",
			"America/New_York|US/East-Indiana",
			"America/New_York|US/Eastern",
			"America/New_York|US/Michigan",
			"America/Noronha|Atlantic/South_Georgia",
			"America/Noronha|Brazil/DeNoronha",
			"America/Noronha|Etc/GMT+2",
			"America/Panama|America/Atikokan",
			"America/Panama|America/Cayman",
			"America/Panama|America/Coral_Harbour",
			"America/Panama|America/Jamaica",
			"America/Panama|EST",
			"America/Panama|Jamaica",
			"America/Phoenix|America/Creston",
			"America/Phoenix|America/Dawson_Creek",
			"America/Phoenix|America/Hermosillo",
			"America/Phoenix|MST",
			"America/Phoenix|US/Arizona",
			"America/Santiago|Chile/Continental",
			"America/Santo_Domingo|America/Anguilla",
			"America/Santo_Domingo|America/Antigua",
			"America/Santo_Domingo|America/Aruba",
			"America/Santo_Domingo|America/Barbados",
			"America/Santo_Domingo|America/Blanc-Sablon",
			"America/Santo_Domingo|America/Curacao",
			"America/Santo_Domingo|America/Dominica",
			"America/Santo_Domingo|America/Grenada",
			"America/Santo_Domingo|America/Guadeloupe",
			"America/Santo_Domingo|America/Kralendijk",
			"America/Santo_Domingo|America/Lower_Princes",
			"America/Santo_Domingo|America/Marigot",
			"America/Santo_Domingo|America/Martinique",
			"America/Santo_Domingo|America/Montserrat",
			"America/Santo_Domingo|America/Port_of_Spain",
			"America/Santo_Domingo|America/Puerto_Rico",
			"America/Santo_Domingo|America/St_Barthelemy",
			"America/Santo_Domingo|America/St_Kitts",
			"America/Santo_Domingo|America/St_Lucia",
			"America/Santo_Domingo|America/St_Thomas",
			"America/Santo_Domingo|America/St_Vincent",
			"America/Santo_Domingo|America/Tortola",
			"America/Santo_Domingo|America/Virgin",
			"America/Sao_Paulo|Brazil/East",
			"America/St_Johns|Canada/Newfoundland",
			"Antarctica/Palmer|America/Punta_Arenas",
			"Asia/Baghdad|Antarctica/Syowa",
			"Asia/Baghdad|Asia/Aden",
			"Asia/Baghdad|Asia/Bahrain",
			"Asia/Baghdad|Asia/Kuwait",
			"Asia/Baghdad|Asia/Qatar",
			"Asia/Baghdad|Asia/Riyadh",
			"Asia/Baghdad|Etc/GMT-3",
			"Asia/Baghdad|Europe/Minsk",
			"Asia/Bangkok|Antarctica/Davis",
			"Asia/Bangkok|Asia/Ho_Chi_Minh",
			"Asia/Bangkok|Asia/Novokuznetsk",
			"Asia/Bangkok|Asia/Phnom_Penh",
			"Asia/Bangkok|Asia/Saigon",
			"Asia/Bangkok|Asia/Vientiane",
			"Asia/Bangkok|Etc/GMT-7",
			"Asia/Bangkok|Indian/Christmas",
			"Asia/Dhaka|Antarctica/Vostok",
			"Asia/Dhaka|Asia/Almaty",
			"Asia/Dhaka|Asia/Bishkek",
			"Asia/Dhaka|Asia/Dacca",
			"Asia/Dhaka|Asia/Kashgar",
			"Asia/Dhaka|Asia/Qostanay",
			"Asia/Dhaka|Asia/Thimbu",
			"Asia/Dhaka|Asia/Thimphu",
			"Asia/Dhaka|Asia/Urumqi",
			"Asia/Dhaka|Etc/GMT-6",
			"Asia/Dhaka|Indian/Chagos",
			"Asia/Dili|Etc/GMT-9",
			"Asia/Dili|Pacific/Palau",
			"Asia/Dubai|Asia/Muscat",
			"Asia/Dubai|Asia/Tbilisi",
			"Asia/Dubai|Asia/Yerevan",
			"Asia/Dubai|Etc/GMT-4",
			"Asia/Dubai|Europe/Samara",
			"Asia/Dubai|Indian/Mahe",
			"Asia/Dubai|Indian/Mauritius",
			"Asia/Dubai|Indian/Reunion",
			"Asia/Gaza|Asia/Hebron",
			"Asia/Hong_Kong|Hongkong",
			"Asia/Jakarta|Asia/Pontianak",
			"Asia/Jerusalem|Asia/Tel_Aviv",
			"Asia/Jerusalem|Israel",
			"Asia/Kamchatka|Asia/Anadyr",
			"Asia/Kamchatka|Etc/GMT-12",
			"Asia/Kamchatka|Kwajalein",
			"Asia/Kamchatka|Pacific/Funafuti",
			"Asia/Kamchatka|Pacific/Kwajalein",
			"Asia/Kamchatka|Pacific/Majuro",
			"Asia/Kamchatka|Pacific/Nauru",
			"Asia/Kamchatka|Pacific/Tarawa",
			"Asia/Kamchatka|Pacific/Wake",
			"Asia/Kamchatka|Pacific/Wallis",
			"Asia/Kathmandu|Asia/Katmandu",
			"Asia/Kolkata|Asia/Calcutta",
			"Asia/Kuala_Lumpur|Asia/Brunei",
			"Asia/Kuala_Lumpur|Asia/Kuching",
			"Asia/Kuala_Lumpur|Asia/Singapore",
			"Asia/Kuala_Lumpur|Etc/GMT-8",
			"Asia/Kuala_Lumpur|Singapore",
			"Asia/Makassar|Asia/Ujung_Pandang",
			"Asia/Rangoon|Asia/Yangon",
			"Asia/Rangoon|Indian/Cocos",
			"Asia/Seoul|ROK",
			"Asia/Shanghai|Asia/Chongqing",
			"Asia/Shanghai|Asia/Chungking",
			"Asia/Shanghai|Asia/Harbin",
			"Asia/Shanghai|Asia/Macao",
			"Asia/Shanghai|Asia/Macau",
			"Asia/Shanghai|Asia/Taipei",
			"Asia/Shanghai|PRC",
			"Asia/Shanghai|ROC",
			"Asia/Tashkent|Antarctica/Mawson",
			"Asia/Tashkent|Asia/Aqtau",
			"Asia/Tashkent|Asia/Aqtobe",
			"Asia/Tashkent|Asia/Ashgabat",
			"Asia/Tashkent|Asia/Ashkhabad",
			"Asia/Tashkent|Asia/Atyrau",
			"Asia/Tashkent|Asia/Dushanbe",
			"Asia/Tashkent|Asia/Oral",
			"Asia/Tashkent|Asia/Samarkand",
			"Asia/Tashkent|Etc/GMT-5",
			"Asia/Tashkent|Indian/Kerguelen",
			"Asia/Tashkent|Indian/Maldives",
			"Asia/Tehran|Iran",
			"Asia/Tokyo|Japan",
			"Asia/Ulaanbaatar|Asia/Choibalsan",
			"Asia/Ulaanbaatar|Asia/Ulan_Bator",
			"Asia/Vladivostok|Asia/Ust-Nera",
			"Asia/Yakutsk|Asia/Khandyga",
			"Atlantic/Azores|America/Scoresbysund",
			"Atlantic/Cape_Verde|Etc/GMT+1",
			"Australia/Adelaide|Australia/Broken_Hill",
			"Australia/Adelaide|Australia/South",
			"Australia/Adelaide|Australia/Yancowinna",
			"Australia/Brisbane|Australia/Lindeman",
			"Australia/Brisbane|Australia/Queensland",
			"Australia/Darwin|Australia/North",
			"Australia/Lord_Howe|Australia/LHI",
			"Australia/Perth|Australia/West",
			"Australia/Sydney|Australia/ACT",
			"Australia/Sydney|Australia/Canberra",
			"Australia/Sydney|Australia/Currie",
			"Australia/Sydney|Australia/Hobart",
			"Australia/Sydney|Australia/Melbourne",
			"Australia/Sydney|Australia/NSW",
			"Australia/Sydney|Australia/Tasmania",
			"Australia/Sydney|Australia/Victoria",
			"Etc/UTC|Etc/UCT",
			"Etc/UTC|Etc/Universal",
			"Etc/UTC|Etc/Zulu",
			"Etc/UTC|UCT",
			"Etc/UTC|UTC",
			"Etc/UTC|Universal",
			"Etc/UTC|Zulu",
			"Europe/Athens|Asia/Nicosia",
			"Europe/Athens|EET",
			"Europe/Athens|Europe/Bucharest",
			"Europe/Athens|Europe/Helsinki",
			"Europe/Athens|Europe/Kiev",
			"Europe/Athens|Europe/Mariehamn",
			"Europe/Athens|Europe/Nicosia",
			"Europe/Athens|Europe/Riga",
			"Europe/Athens|Europe/Sofia",
			"Europe/Athens|Europe/Tallinn",
			"Europe/Athens|Europe/Uzhgorod",
			"Europe/Athens|Europe/Vilnius",
			"Europe/Athens|Europe/Zaporozhye",
			"Europe/Chisinau|Europe/Tiraspol",
			"Europe/Dublin|Eire",
			"Europe/Istanbul|Asia/Istanbul",
			"Europe/Istanbul|Turkey",
			"Europe/Lisbon|Atlantic/Canary",
			"Europe/Lisbon|Atlantic/Faeroe",
			"Europe/Lisbon|Atlantic/Faroe",
			"Europe/Lisbon|Atlantic/Madeira",
			"Europe/Lisbon|Portugal",
			"Europe/Lisbon|WET",
			"Europe/London|Europe/Belfast",
			"Europe/London|Europe/Guernsey",
			"Europe/London|Europe/Isle_of_Man",
			"Europe/London|Europe/Jersey",
			"Europe/London|GB",
			"Europe/London|GB-Eire",
			"Europe/Moscow|W-SU",
			"Europe/Paris|Africa/Ceuta",
			"Europe/Paris|Arctic/Longyearbyen",
			"Europe/Paris|Atlantic/Jan_Mayen",
			"Europe/Paris|CET",
			"Europe/Paris|Europe/Amsterdam",
			"Europe/Paris|Europe/Andorra",
			"Europe/Paris|Europe/Belgrade",
			"Europe/Paris|Europe/Berlin",
			"Europe/Paris|Europe/Bratislava",
			"Europe/Paris|Europe/Brussels",
			"Europe/Paris|Europe/Budapest",
			"Europe/Paris|Europe/Busingen",
			"Europe/Paris|Europe/Copenhagen",
			"Europe/Paris|Europe/Gibraltar",
			"Europe/Paris|Europe/Ljubljana",
			"Europe/Paris|Europe/Luxembourg",
			"Europe/Paris|Europe/Madrid",
			"Europe/Paris|Europe/Malta",
			"Europe/Paris|Europe/Monaco",
			"Europe/Paris|Europe/Oslo",
			"Europe/Paris|Europe/Podgorica",
			"Europe/Paris|Europe/Prague",
			"Europe/Paris|Europe/Rome",
			"Europe/Paris|Europe/San_Marino",
			"Europe/Paris|Europe/Sarajevo",
			"Europe/Paris|Europe/Skopje",
			"Europe/Paris|Europe/Stockholm",
			"Europe/Paris|Europe/Tirane",
			"Europe/Paris|Europe/Vaduz",
			"Europe/Paris|Europe/Vatican",
			"Europe/Paris|Europe/Vienna",
			"Europe/Paris|Europe/Warsaw",
			"Europe/Paris|Europe/Zagreb",
			"Europe/Paris|Europe/Zurich",
			"Europe/Paris|Poland",
			"Europe/Ulyanovsk|Europe/Astrakhan",
			"Pacific/Auckland|Antarctica/McMurdo",
			"Pacific/Auckland|Antarctica/South_Pole",
			"Pacific/Auckland|NZ",
			"Pacific/Chatham|NZ-CHAT",
			"Pacific/Easter|Chile/EasterIsland",
			"Pacific/Fakaofo|Etc/GMT-13",
			"Pacific/Fakaofo|Pacific/Enderbury",
			"Pacific/Galapagos|Etc/GMT+6",
			"Pacific/Gambier|Etc/GMT+9",
			"Pacific/Guadalcanal|Antarctica/Macquarie",
			"Pacific/Guadalcanal|Etc/GMT-11",
			"Pacific/Guadalcanal|Pacific/Efate",
			"Pacific/Guadalcanal|Pacific/Kosrae",
			"Pacific/Guadalcanal|Pacific/Noumea",
			"Pacific/Guadalcanal|Pacific/Pohnpei",
			"Pacific/Guadalcanal|Pacific/Ponape",
			"Pacific/Guam|Pacific/Saipan",
			"Pacific/Honolulu|HST",
			"Pacific/Honolulu|Pacific/Johnston",
			"Pacific/Honolulu|US/Hawaii",
			"Pacific/Kiritimati|Etc/GMT-14",
			"Pacific/Niue|Etc/GMT+11",
			"Pacific/Pago_Pago|Pacific/Midway",
			"Pacific/Pago_Pago|Pacific/Samoa",
			"Pacific/Pago_Pago|US/Samoa",
			"Pacific/Pitcairn|Etc/GMT+8",
			"Pacific/Port_Moresby|Antarctica/DumontDUrville",
			"Pacific/Port_Moresby|Etc/GMT-10",
			"Pacific/Port_Moresby|Pacific/Chuuk",
			"Pacific/Port_Moresby|Pacific/Truk",
			"Pacific/Port_Moresby|Pacific/Yap",
			"Pacific/Tahiti|Etc/GMT+10",
			"Pacific/Tahiti|Pacific/Rarotonga"
		]
	});


	return moment;
}));
//! moment.js locale configuration

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


    function translate(number, withoutSuffix, key) {
        var result = number + ' ';
        switch (key) {
            case 'ss':
                if (number === 1) {
                    result += 'sekunda';
                } else if (number === 2 || number === 3 || number === 4) {
                    result += 'sekunde';
                } else {
                    result += 'sekundi';
                }
                return result;
            case 'm':
                return withoutSuffix ? 'jedna minuta' : 'jedne minute';
            case 'mm':
                if (number === 1) {
                    result += 'minuta';
                } else if (number === 2 || number === 3 || number === 4) {
                    result += 'minute';
                } else {
                    result += 'minuta';
                }
                return result;
            case 'h':
                return withoutSuffix ? 'jedan sat' : 'jednog sata';
            case 'hh':
                if (number === 1) {
                    result += 'sat';
                } else if (number === 2 || number === 3 || number === 4) {
                    result += 'sata';
                } else {
                    result += 'sati';
                }
                return result;
            case 'dd':
                if (number === 1) {
                    result += 'dan';
                } else {
                    result += 'dana';
                }
                return result;
            case 'MM':
                if (number === 1) {
                    result += 'mjesec';
                } else if (number === 2 || number === 3 || number === 4) {
                    result += 'mjeseca';
                } else {
                    result += 'mjeseci';
                }
                return result;
            case 'yy':
                if (number === 1) {
                    result += 'godina';
                } else if (number === 2 || number === 3 || number === 4) {
                    result += 'godine';
                } else {
                    result += 'godina';
                }
                return result;
        }
    }

    var bs = moment.defineLocale('bs', {
        months : 'januar_februar_mart_april_maj_juni_juli_august_septembar_oktobar_novembar_decembar'.split('_'),
        monthsShort : 'jan._feb._mar._apr._maj._jun._jul._aug._sep._okt._nov._dec.'.split('_'),
        monthsParseExact: true,
        weekdays : 'nedjelja_ponedjeljak_utorak_srijeda_četvrtak_petak_subota'.split('_'),
        weekdaysShort : 'ned._pon._uto._sri._čet._pet._sub.'.split('_'),
        weekdaysMin : 'ne_po_ut_sr_če_pe_su'.split('_'),
        weekdaysParseExact : true,
        longDateFormat : {
            LT : 'H:mm',
            LTS : 'H:mm:ss',
            L : 'DD.MM.YYYY',
            LL : 'D. MMMM YYYY',
            LLL : 'D. MMMM YYYY H:mm',
            LLLL : 'dddd, D. MMMM YYYY H:mm'
        },
        calendar : {
            sameDay  : '[danas u] LT',
            nextDay  : '[sutra u] LT',
            nextWeek : function () {
                switch (this.day()) {
                    case 0:
                        return '[u] [nedjelju] [u] LT';
                    case 3:
                        return '[u] [srijedu] [u] LT';
                    case 6:
                        return '[u] [subotu] [u] LT';
                    case 1:
                    case 2:
                    case 4:
                    case 5:
                        return '[u] dddd [u] LT';
                }
            },
            lastDay  : '[jučer u] LT',
            lastWeek : function () {
                switch (this.day()) {
                    case 0:
                    case 3:
                        return '[prošlu] dddd [u] LT';
                    case 6:
                        return '[prošle] [subote] [u] LT';
                    case 1:
                    case 2:
                    case 4:
                    case 5:
                        return '[prošli] dddd [u] LT';
                }
            },
            sameElse : 'L'
        },
        relativeTime : {
            future : 'za %s',
            past   : 'prije %s',
            s      : 'par sekundi',
            ss     : translate,
            m      : translate,
            mm     : translate,
            h      : translate,
            hh     : translate,
            d      : 'dan',
            dd     : translate,
            M      : 'mjesec',
            MM     : translate,
            y      : 'godinu',
            yy     : translate
        },
        dayOfMonthOrdinalParse: /\d{1,2}\./,
        ordinal : '%d.',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 7  // The week that contains Jan 7th is the first week of the year.
        }
    });

    return bs;

})));

// moment-timezone-localization for lang code: bs

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"Abidjan","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"Accra","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"Addis Ababa","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"Algiers","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"Asmara","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"Bamako","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"Bangui","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"Banjul","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"Bissau","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"Blantyre","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"Brazzaville","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"Bujumbura","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"Kairo","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"Kazablanka","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"Ceuta","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"Conakry","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"Dakar","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"Dar es Salaam","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"Džibuti","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"Douala","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"El Aaiun","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"Freetown","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"Gaborone","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"Harare","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"Johannesburg","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"Juba","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"Kampala","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"Kartum","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"Kigali","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"Kinshasa","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"Lagos","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"Libreville","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"Lome","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"Luanda","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"Lubumbashi","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"Lusaka","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"Malabo","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"Maputo","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"Maseru","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"Mbabane","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"Mogadiš","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"Monrovia","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"Nairobi","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"Ndjamena","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"Niamey","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"Nouakchott","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"Ouagadougou","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"Porto-Novo","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"Sao Tome","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"Tripoli","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"Tunis","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"Windhoek","id":"Africa/Windhoek"},{"value":"America/Adak","name":"Adak","id":"America/Adak"},{"value":"America/Anchorage","name":"Anchorage","id":"America/Anchorage"},{"value":"America/Anguilla","name":"Angvila","id":"America/Anguilla"},{"value":"America/Antigua","name":"Antigva","id":"America/Antigua"},{"value":"America/Araguaina","name":"Araguaina","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"La Rioja","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"Rio Gallegos","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"Salta","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"San Juan","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"San Luis","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"Tucuman","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"Ushuaia","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"Aruba","id":"America/Aruba"},{"value":"America/Asuncion","name":"Asuncion","id":"America/Asuncion"},{"value":"America/Bahia","name":"Bahia","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"Bahia Banderas","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"Barbados","id":"America/Barbados"},{"value":"America/Belem","name":"Belem","id":"America/Belem"},{"value":"America/Belize","name":"Belize","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"Blanc-Sablon","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"Boa Vista","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"Bogota","id":"America/Bogota"},{"value":"America/Boise","name":"Boise","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"Buenos Aires","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"Cambridge Bay","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"Campo Grande","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"Cancun","id":"America/Cancun"},{"value":"America/Caracas","name":"Caracas","id":"America/Caracas"},{"value":"America/Catamarca","name":"Catamarca","id":"America/Catamarca"},{"value":"America/Cayenne","name":"Cayenne","id":"America/Cayenne"},{"value":"America/Cayman","name":"Kajman","id":"America/Cayman"},{"value":"America/Chicago","name":"Chicago","id":"America/Chicago"},{"value":"America/Chihuahua","name":"Chihuahua","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"Atikokan","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"Cordoba","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"Kostarika","id":"America/Costa_Rica"},{"value":"America/Creston","name":"Creston","id":"America/Creston"},{"value":"America/Cuiaba","name":"Cuiaba","id":"America/Cuiaba"},{"value":"America/Curacao","name":"Kurasao","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"Danmarkshavn","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"Dawson","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"Dawson Creek","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"Denver","id":"America/Denver"},{"value":"America/Detroit","name":"Detroit","id":"America/Detroit"},{"value":"America/Dominica","name":"Dominika","id":"America/Dominica"},{"value":"America/Edmonton","name":"Edmonton","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"Eirunepe","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"Salvador","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"Fort Nelson","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"Fortaleza","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"Glace Bay","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"Nuuk","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"Goose Bay","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"Grand Turk","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"Grenada","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"Gvadalupe","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"Gvatemala","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"Guayaquil","id":"America/Guayaquil"},{"value":"America/Guyana","name":"Guyana","id":"America/Guyana"},{"value":"America/Halifax","name":"Halifax","id":"America/Halifax"},{"value":"America/Havana","name":"Havana","id":"America/Havana"},{"value":"America/Hermosillo","name":"Hermosillo","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"Knox, Indiana","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"Marengo, Indiana","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"Petersburg, Indiana","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"Tell City, Indiana","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"Vevay, Indiana","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"Vincennes, Indiana","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"Winamac, Indiana","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"Indianapolis","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"Inuvik","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"Iqaluit","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"Jamajka","id":"America/Jamaica"},{"value":"America/Jujuy","name":"Jujuy","id":"America/Jujuy"},{"value":"America/Juneau","name":"Juneau","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"Monticello, Kentucky","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"Kralendijk","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"La Paz","id":"America/La_Paz"},{"value":"America/Lima","name":"Lima","id":"America/Lima"},{"value":"America/Los_Angeles","name":"Los Angeles","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"Louisville","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"Lower Prince’s Quarter","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"Maceio","id":"America/Maceio"},{"value":"America/Managua","name":"Managua","id":"America/Managua"},{"value":"America/Manaus","name":"Manaus","id":"America/Manaus"},{"value":"America/Marigot","name":"Marigot","id":"America/Marigot"},{"value":"America/Martinique","name":"Martinique","id":"America/Martinique"},{"value":"America/Matamoros","name":"Matamoros","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"Mazatlan","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"Mendoza","id":"America/Mendoza"},{"value":"America/Menominee","name":"Menominee","id":"America/Menominee"},{"value":"America/Merida","name":"Merida","id":"America/Merida"},{"value":"America/Metlakatla","name":"Metlakatla","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"Mexico City","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"Miquelon","id":"America/Miquelon"},{"value":"America/Moncton","name":"Moncton","id":"America/Moncton"},{"value":"America/Monterrey","name":"Monterrey","id":"America/Monterrey"},{"value":"America/Montevideo","name":"Montevideo","id":"America/Montevideo"},{"value":"America/Montserrat","name":"Montserrat","id":"America/Montserrat"},{"value":"America/Nassau","name":"Nassau","id":"America/Nassau"},{"value":"America/New_York","name":"New York","id":"America/New_York"},{"value":"America/Nipigon","name":"Nipigon","id":"America/Nipigon"},{"value":"America/Nome","name":"Nome","id":"America/Nome"},{"value":"America/Noronha","name":"Noronha","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"Beulah, Sjeverna Dakota","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"Center, Sjeverna Dakota","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"New Salem, Sjeverna Dakota","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"Ojinaga","id":"America/Ojinaga"},{"value":"America/Panama","name":"Panama","id":"America/Panama"},{"value":"America/Pangnirtung","name":"Pangnirtung","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"Paramaribo","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"Phoenix","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"Port-au-Prince","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"Port of Spain","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"Porto Velho","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"Portoriko","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"Punta Arenas","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"Rainy River","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"Rankin Inlet","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"Recife","id":"America/Recife"},{"value":"America/Regina","name":"Regina","id":"America/Regina"},{"value":"America/Resolute","name":"Resolute","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"Rio Branco","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"Santa Isabel","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"Santarem","id":"America/Santarem"},{"value":"America/Santiago","name":"Santiago","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"Santo Domingo","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"Sao Paulo","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"Ittoqqortoormiit","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"Sitka","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"St. Barthelemy","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"St. John’s","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"St. Kitts","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"St. Lucia","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"St. Thomas","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"St. Vincent","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"Swift Current","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"Tegucigalpa","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"Thule","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"Thunder Bay","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"Tijuana","id":"America/Tijuana"},{"value":"America/Toronto","name":"Toronto","id":"America/Toronto"},{"value":"America/Tortola","name":"Tortola","id":"America/Tortola"},{"value":"America/Vancouver","name":"Vancouver","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"Whitehorse","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"Winnipeg","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"Yakutat","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"Yellowknife","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"Casey","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"Davis","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"Dumont d’Urville","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"Macquarie","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"Mawson","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"McMurdo","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"Palmer","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"Rothera","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"Syowa","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"Troll","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"Vostok","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"Longyearbyen","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"Aden","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"Almati","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"Aman","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"Anadir","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"Aktau","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"Akutobe","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"Ašhabad","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"Atyrau","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"Bagdad","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"Bahrein","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"Baku","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"Bangkok","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"Barnaul","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"Bejrut","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"Biškek","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"Bruneji","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"Kolkata","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"Chita","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"Čojbalsan","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"Kolombo","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"Damask","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"Daka","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"Dili","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"Dubai","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"Dušanbe","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"Famagusta","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"Gaza","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"Hebron","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"Hong Kong","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"Hovd","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"Irkutsk","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"Džakarta","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"Džajapura","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"Jeruzalem","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"Kabul","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"Kamčatka","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"Karači","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"Katmandu","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"Handiga","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"Krasnojarsk","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"Kuala Lumpur","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"Kučing","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"Kuvajt","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"Makau","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"Magadan","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"Makasar","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"Manila","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"Muskat","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"Nikozija","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"Novokuznjeck","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"Novosibirsk","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"Omsk","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"Oral","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"Pnom Pen","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"Pontianak","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"Pjongjang","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"Katar","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"Kizilorda","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"Rangun","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"Rijad","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"Ho Ši Min","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"Sahalin","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"Samarkand","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"Seul","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"Šangaj","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"Singapur","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"Srednekolymsk","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"Tajpej","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"Taškent","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"Tbilisi","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"Teheran","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"Thimphu","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"Tokio","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"Tomsk","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"Ulan Bator","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"Urumči","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"Ust-Nera","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"Vijentijan","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"Vladivostok","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"Jakutsk","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"Jekaterinburg","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"Jerevan","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"Azori","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"Bermuda","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"Kanari","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"Kape Verde","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"Faroe","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"Madeira","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"Rejkjavik","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"South Georgia","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"Sveta Helena","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"Stanley","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"Adelaide","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"Brisbane","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"Broken Hill","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"Currie","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"Darwin","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"Eucla","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"Hobart","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"Lindeman","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"Lord Hau","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"Melburn","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"Pert","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"Sidnej","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"Koordinirano svjetsko vrijeme","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"Amsterdam","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"Andora","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"Astrahan","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"Atina","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"Beograd","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"Berlin","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"Bratislava","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"Brisel","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"Bukurešt","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"Budimpešta","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"Busingen","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"Kišinjev","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"Kopenhagen","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"Irsko standardno vrijemeDablin","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"Gibraltar","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"Gernzi","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"Helsinki","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"Ostrvo Man","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"Istanbul","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"Jersey","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"Kalinjingrad","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"Kijev","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"Kirov","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"Lisabon","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"Ljubljana","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"Britansko ljetno vrijemeLondon","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"Luksemburg","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"Madrid","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"Malta","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"Mariehamn","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"Minsk","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"Monako","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"Moskva","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"Oslo","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"Pariz","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"Podgorica","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"Prag","id":"Europe/Prague"},{"value":"Europe/Riga","name":"Riga","id":"Europe/Riga"},{"value":"Europe/Rome","name":"Rim","id":"Europe/Rome"},{"value":"Europe/Samara","name":"Samara","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"San Marino","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"Sarajevo","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"Saratov","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"Simferopolj","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"Skoplje","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"Sofija","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"Štokholm","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"Talin","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"Tirana","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"Ulyanovsk","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"Užgorod","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"Vaduz","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"Vatikan","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"Beč","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"Vilnius","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"Volgograd","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"Varšava","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"Zagreb","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"Zaporožje","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"Cirih","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"Antananarivo","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"Chagos","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"Božićno ostrvo","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"Kokosova ostrva","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"Comoro","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"Kerguelen","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"Mahe","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"Maldivi","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"Mauricijus","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"Mayotte","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"Reunion","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"Apia","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"Auckland","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"Bougainville","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"Chatham","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"Easter","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"Efate","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"Enderbury","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"Fakaofo","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"Fidži","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"Funafuti","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"Galapagos","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"Gambier","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"Guadalcanal","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"Guam","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"Honolulu","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"Johnston","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"Kiritimati","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"Kosrae","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"Kwajalein","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"Majuro","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"Marquesas","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"Midway","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"Nauru","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"Niue","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"Norfolk","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"Noumea","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"Pago Pago","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"Palau","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"Pitkern","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"Pohnpei","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"Port Moresby","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"Rarotonga","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"Saipan","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"Tahiti","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"Tarawa","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"Tongatapu","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"Chuuk","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"Wake","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"Valis","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
