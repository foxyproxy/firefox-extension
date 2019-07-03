/*!
 * jQuery Swapsie Plugin
 * Examples and documentation at: http://biostall.com/swap-and-re-order-divs-smoothly-using-jquery-swapsie-plugin
 * Copyright (c) 2010 Steve Marks - info@biostall.com
 * Licensed under the MIT license: http://www.opensource.org/licenses/mit-license.php
 * Version: 1 (09-JULY-2010)
 */

var swapping = false;

(function($) {
    $.fn.extend({
        swap: function(options) {
			
			var defaults = {
			    target: "",
				speed: 1000,
				opacity: "1",
				callback: function() {}
			};
			var options = $.extend(defaults, options);
			
			return this.each(function() {
				
				var obj = $(this);
				
				if (options.target!="" && !swapping) {
					
					swapping = true;
					
					// set primary and secondary elements to relative if not already specified a positon CSS attribute
					var current_primary_pos = obj.css("position");
					var current_secondary_pos = $("#"+options.target).css("position");
					if (current_primary_pos!="relative" && current_primary_pos!="absolute") {
						obj.css("position", "relative");
					}
					if (current_secondary_pos!="relative" && current_secondary_pos!="absolute") {
						$("#"+options.target).css("position", "relative");
					}
					//
					
					// calculate y-axis movement
					var current_primary_position = obj.offset();
					var current_primary_top = current_primary_position.top;
					var current_secondary_position = $("#"+options.target).offset();
					var current_secondary_top = current_secondary_position.top;
					var direction_primary_y = '-';
					var direction_secondary_y = '-';
					if (current_primary_top<=current_secondary_top) { // if primary above secondary 
						var direction_primary_y = '+'; 
						var total_y = current_secondary_top-current_primary_top;
					}else{ // if primary below secondary 
						var total_y = current_primary_top-current_secondary_top;
					}
					if (direction_primary_y=='-') { direction_secondary_y='+'; }else{ direction_secondary_y='-'; }
					//
					
					// calculate x-axis movement
					var current_primary_position = obj.offset();
					var current_primary_left = current_primary_position.left;
					var current_secondary_position = $("#"+options.target).offset();
					var current_secondary_left = current_secondary_position.left;
					var direction_primary_x = '-';
					var direction_secondary_x = '-';
					if (current_primary_left<=current_secondary_left) { // if primary left of secondary 
						var direction_primary_x = '+'; 
						var total_x = current_secondary_left-current_primary_left;
					}else{ // if primary below secondary 
						var total_x = current_primary_left-current_secondary_left;
					}
					if (direction_primary_x=='-') { direction_secondary_x='+'; }else{ direction_secondary_x='-'; }
					//
					
					// do swapping
					obj.animate({
						opacity: options.opacity
					}, 100, function() {
						obj.animate({
							top: direction_primary_y+"="+(total_y)+"px",
							left: direction_primary_x+"="+(total_x)+"px"
						}, options.speed, function() {
							obj.animate({
								opacity: "1"
							}, 100);
						});
					});
					$("#"+options.target).animate({
						opacity: options.opacity
					}, 100, function() {
						$("#"+options.target).animate({
							top: direction_secondary_y+"="+(total_y)+"px",
							left: direction_secondary_x+"="+(total_x)+"px"
						}, options.speed, function() {
							$("#"+options.target).animate({
								opacity: "1"
							}, 100, function() { 
								swapping = false; // call the callback and apply the scope:
    								options.callback.call(this);
 							});
						});
					});
					
				}
				
			});
			
			
        }
    });
})(jQuery);